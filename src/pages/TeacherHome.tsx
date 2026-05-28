import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, BarChart2, Check, ClipboardList, Footprints, Loader2, Medal, MessageSquare, Plus, QrCode, Send, Star, Trash2, Trophy, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TeacherBottomNav } from "@/components/TeacherBottomNav";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAppRole } from "@/lib/roles";
import { BOOST_POINT_RULES, DAILY_EXERCISE_GOALS, DAILY_STEP_GOAL, countCompletedDailyExercises } from "@/lib/gamification";
import { formatDisplayName } from "@/lib/formatName";
import { JumpingJacksIcon, PlankIcon, PushUpIcon, SitUpIcon, SquatIcon } from "@/components/ExerciseIcons";
import {
  getTeacherClasses,
  getTeacherClassesAuth,
  getClassStudents,
  getClassStudentsAuth,
  type ClassStudent,
  type TeacherClass,
} from "@/services/codeAuthService";
import { DEMO_STUDENT_DISPLAY_NAME } from "@/lib/demo";

type AuthMode = "supabase" | "code";
type ActiveTab = "home" | "uebersicht" | "wertung" | "mitmachen";

type TeacherProgress = {
  push_ups: number;
  squats: number;
  planks: number;
  sit_ups: number;
  jumping_jacks: number;
  steps: number;
};

const EMPTY_PROGRESS: TeacherProgress = {
  push_ups: 0, squats: 0, planks: 0, sit_ups: 0, jumping_jacks: 0, steps: 0,
};

const teacherStorageKey = (uid: string, date: string) => `boost:teacher-daily:${uid}:${date}`;

const loadTeacherDailyProgress = (uid: string, date: string): TeacherProgress => {
  try {
    const raw = localStorage.getItem(teacherStorageKey(uid, date));
    return raw ? { ...EMPTY_PROGRESS, ...(JSON.parse(raw) as Partial<TeacherProgress>) } : { ...EMPTY_PROGRESS };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
};

type DailyRow = {
  user_id: string;
  date: string;
  jumping_jacks: number | null;
  push_ups: number | null;
  squats: number | null;
  planks: number | null;
  sit_ups: number | null;
  steps: number | null;
  steps_tracking_active: boolean | null;
};

type StudentStat = {
  studentId: string;
  name: string;
  todayPercent: number;
  weekActiveDays: number;
};

type DayStat = {
  date: string;
  label: string;
  activeCount: number;
  totalCount: number;
};

type StudentRank = {
  id: string;
  name: string;
  points: number;
};

const STREAK_THRESHOLD = 90;
const ACTIVE_PROGRESS_THRESHOLD = 0;

const getStudentProgressIds = (student: ClassStudent) =>
  Array.from(new Set([
    student.progress_user_id,
    student.auth_user_id,
    student.student_id,
  ].filter(Boolean) as string[]));

const getPrimaryProgressId = (student: ClassStudent) =>
  student.progress_user_id || student.auth_user_id || student.student_id;

function getDayProgress(row: DailyRow): number {
  const steps = row.steps_tracking_active ? Number(row.steps || 0) : 0;
  const done = countCompletedDailyExercises({
    jumping_jacks: row.jumping_jacks || 0,
    push_ups: row.push_ups || 0,
    squats: row.squats || 0,
    planks: row.planks || 0,
    sit_ups: row.sit_ups || 0,
  });
  const completed = (steps >= DAILY_STEP_GOAL ? 1 : 0) + done;
  const total = Object.keys(DAILY_EXERCISE_GOALS).length + 1;
  return Math.min(100, Math.round((completed / total) * 100));
}

function getRankBadge(rank: number) {
  if (rank === 1) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500 text-xs font-black text-white">1</span>;
  if (rank === 2) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-400 text-xs font-black text-white">2</span>;
  if (rank === 3) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-xs font-black text-white">3</span>;
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">{rank}</span>;
}

export default function TeacherHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session: codeSession, loading: codeLoading } = useCodeAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [teacherName, setTeacherName] = useState("Lehrkraft");
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const initialTab = (location.state as { tab?: ActiveTab } | null)?.tab ?? "home";
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Mitmachen tab state
  const [teacherId, setTeacherId] = useState<string>("");
  const [teacherProgress, setTeacherProgress] = useState<TeacherProgress>({ ...EMPTY_PROGRESS });
  const [teacherTodayDbData, setTeacherTodayDbData] = useState({ push_ups: 0, squats: 0, planks: 0, sit_ups: 0, jumping_jacks: 0 });
  const [teacherPoints, setTeacherPoints] = useState<number | null>(null);

  // Teacher class assignment state (supabase auth only)
  type TeacherClassAssignment = { id: string; school_id: string; school_name: string; class_id: string; class_name: string };
  type PendingStudent = { assignment_id: string; student_id: string; username: string; school_name: string; class_name: string; created_at: string };
  const [teacherClassAssignments, setTeacherClassAssignments] = useState<TeacherClassAssignment[]>([]);
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [pendingStudentsLoading, setPendingStudentsLoading] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<{ id: string; name: string }[]>([]);
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([]);
  const [assignSchoolId, setAssignSchoolId] = useState("");
  const [assignClassId, setAssignClassId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignClassesLoading, setAssignClassesLoading] = useState(false);

  // Feedback state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // Overview tab state
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentStats, setStudentStats] = useState<StudentStat[]>([]);
  const [dayStats, setDayStats] = useState<DayStat[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Ranking tab state
  const [studentRanks, setStudentRanks] = useState<StudentRank[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);

  const totalStudents = useMemo(
    () => classes.reduce((sum, cls) => sum + Number(cls.student_count || 0), 0),
    [classes],
  );

  const selectedClass = useMemo(
    () => classes.find((c) => c.class_id === selectedClassId),
    [classes, selectedClassId],
  );

  const loadClasses = useCallback(async (mode: AuthMode) => {
    setLoading(true);
    try {
      const nextClasses = mode === "code" && codeSession
        ? await getTeacherClasses(codeSession)
        : await getTeacherClassesAuth();
      setClasses(nextClasses);
      if (nextClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(nextClasses[0].class_id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Klassen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [codeSession, selectedClassId]);

  const loadStudents = useCallback(async (mode: AuthMode, classId: string) => {
    if (!classId) return;
    setStudentsLoading(true);
    try {
      const next = mode === "code" && codeSession
        ? await getClassStudents(codeSession, classId)
        : await getClassStudentsAuth(classId);
      setStudents(next);
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, [codeSession]);

  useEffect(() => {
    const resolveTeacher = async () => {
      if (codeLoading) return;

      if (codeSession?.user_type === "teacher") {
        setAuthMode("code");
        setTeacherName(codeSession.display_name || "Lehrkraft");
        setTeacherId(codeSession.user_id);
        await loadClasses("code");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const role = await getCurrentAppRole();
      if (role !== "teacher") {
        navigate("/dashboard", { replace: true });
        return;
      }

      setAuthMode("supabase");
      setTeacherName(
        String(session.user.user_metadata?.username || session.user.email?.split("@")[0] || "Lehrkraft"),
      );
      setTeacherId(session.user.id);
      await loadClasses("supabase");
    };

    void resolveTeacher();
  }, [codeLoading, codeSession, loadClasses, navigate]);

  // Load students when class or tab changes
  useEffect(() => {
    if (!authMode || !selectedClassId) return;
    void loadStudents(authMode, selectedClassId);
  }, [authMode, selectedClassId, loadStudents]);

  // Load teacher class assignments + pending students (supabase auth only)
  useEffect(() => {
    if (authMode !== "supabase") return;

    const loadAssignments = async () => {
      try {
        const { data } = await (supabase.rpc as any)("get_teacher_class_assignments_auth");
        if (Array.isArray(data)) setTeacherClassAssignments(data as TeacherClassAssignment[]);
      } catch { /* ignore */ }
    };

    const loadPending = async () => {
      setPendingStudentsLoading(true);
      try {
        const { data } = await (supabase.rpc as any)("get_pending_students_for_teacher_auth");
        if (Array.isArray(data)) setPendingStudents(data as PendingStudent[]);
      } catch { /* ignore */ } finally {
        setPendingStudentsLoading(false);
      }
    };

    const loadSchools = async () => {
      try {
        const { data } = await (supabase.rpc as any)("get_schools_list");
        if (Array.isArray(data)) setAvailableSchools(data as { id: string; name: string }[]);
      } catch { /* ignore */ }
    };

    void loadAssignments();
    void loadPending();
    void loadSchools();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authMode]);

  // Load classes for teacher assignment panel when school changes
  useEffect(() => {
    if (!assignSchoolId) { setAvailableClasses([]); setAssignClassId(""); return; }
    setAssignClassesLoading(true);
    setAvailableClasses([]);
    setAssignClassId("");
    const load = async () => {
      try {
        const { data } = await (supabase.rpc as any)("get_classes_for_school", { p_school_id: assignSchoolId });
        if (Array.isArray(data)) setAvailableClasses(data as { id: string; name: string }[]);
      } catch { /* ignore */ } finally {
        setAssignClassesLoading(false);
      }
    };
    void load();
  }, [assignSchoolId]);

  // Load weekly overview data
  useEffect(() => {
    if (activeTab !== "uebersicht" || students.length === 0) return;
    void loadOverview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, students]);

  // Load ranking data + teacher's own points
  useEffect(() => {
    if (activeTab !== "wertung") return;
    if (authMode === "supabase" && teacherId) void loadTeacherPoints();
    if (students.length === 0) return;
    void loadRanking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, students, authMode, teacherId]);

  // Load teacher's own daily progress
  useEffect(() => {
    if (activeTab !== "mitmachen" || !teacherId || !authMode) return;
    if (authMode === "supabase") {
      void loadTeacherTodayDbData();
      void loadTeacherPoints();
    } else {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      setTeacherProgress(loadTeacherDailyProgress(teacherId, todayStr));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, teacherId, authMode]);

  // Reload DB data when teacher returns from camera counter
  useEffect(() => {
    if (activeTab !== "mitmachen" || authMode !== "supabase" || !teacherId) return;
    const handleFocus = () => { void loadTeacherTodayDbData(); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authMode, teacherId]);

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");
      const todayStr = format(today, "yyyy-MM-dd");
      const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

      console.log("[Übersicht] authMode:", authMode);
      console.log("[Übersicht] selectedClassId:", selectedClassId);
      console.log("[Übersicht] weekStart:", weekStartStr, "→ weekEnd:", weekEndStr, "today:", todayStr);
      console.log("[Übersicht] numberOfStudentsFound:", students.length);

      let allRows: DailyRow[] = [];

      if (authMode === "code" && codeSession && selectedClassId) {
        console.log("[Übersicht] Lade via RPC get_class_student_daily_results (code-auth)");
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
          "get_class_student_daily_results",
          {
            p_device_id: codeSession.device_id,
            p_session_token: codeSession.session_token,
            p_class_id: selectedClassId,
            p_date_start: weekStartStr,
            p_date_end: weekEndStr,
          }
        );
        console.log("[Übersicht] RPC rpcError:", rpcError);
        console.log("[Übersicht] RPC rpcData:", rpcData);
        if (rpcError) {
          console.error("[Übersicht] RPC Fehler:", rpcError);
          toast.error(`Übersicht-Fehler: ${rpcError.message}`);
        } else if (Array.isArray(rpcData)) {
          allRows = rpcData as DailyRow[];
          console.log("[Übersicht] numberOfActivitiesFound (RPC):", allRows.length);
        } else if (rpcData && typeof rpcData === "object" && (rpcData as any).error) {
          console.error("[Übersicht] RPC returned error object:", (rpcData as any).error);
          toast.error(`Übersicht: ${(rpcData as any).error}`);
        } else {
          console.warn("[Übersicht] Unerwartetes RPC-Ergebnis:", rpcData);
        }
      } else if (selectedClassId) {
        console.log("[Übersicht] Lade via RPC get_class_daily_results_auth (supabase-auth)");
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
          "get_class_daily_results_auth",
          {
            p_class_id: selectedClassId,
            p_date_start: weekStartStr,
            p_date_end: weekEndStr,
          }
        );
        console.log("[Übersicht] RPC error:", rpcError);
        console.log("[Übersicht] RPC data:", rpcData);
        if (rpcError) {
          console.error("[Übersicht] RPC Fehler:", rpcError);
          toast.error(`Übersicht konnte nicht geladen werden: ${rpcError.message}`);
          setStudentStats([]);
          setDayStats([]);
          return;
        } else if (Array.isArray(rpcData)) {
          allRows = rpcData as DailyRow[];
          console.log("[Übersicht] numberOfActivitiesFound (RPC auth):", allRows.length);
        } else if (rpcData && typeof rpcData === "object" && (rpcData as any).error) {
          console.error("[Übersicht] RPC returned error object:", (rpcData as any).error);
          toast.error(`Übersicht: ${(rpcData as any).error}`);
          setStudentStats([]);
          setDayStats([]);
          return;
        } else {
          console.warn("[Übersicht] Unerwartetes RPC-Ergebnis:", rpcData);
        }
      }

      // Inject synthetic data for the demo student: 100% on past days, ~83% today
      const demoStudent = students.find((s) => s.display_name === DEMO_STUDENT_DISPLAY_NAME);
      if (demoStudent) {
        const demoProgressId = getPrimaryProgressId(demoStudent);
        const pastDays = daysOfWeek.filter((d) => d <= today);
        for (const day of pastDays) {
          const dateStr = format(day, "yyyy-MM-dd");
          if (!allRows.some((r) => getStudentProgressIds(demoStudent).includes(r.user_id) && r.date === dateStr)) {
            const isToday = dateStr === todayStr;
            allRows.push({
              user_id: demoProgressId,
              date: dateStr,
              push_ups: 10,
              squats: 10,
              planks: 10,
              sit_ups: 25,
              jumping_jacks: 40,
              steps: isToday ? 0 : 3000,
              steps_tracking_active: !isToday,
            });
          }
        }
      }

      console.log("[Übersicht] Gesamt allRows:", allRows.length);
      console.log("[Übersicht] STREAK_THRESHOLD:", STREAK_THRESHOLD, "(Schüler brauchen >", STREAK_THRESHOLD, "% für 'aktiven Tag')");

      const stats: StudentStat[] = students.map((s) => {
        const progressIds = new Set(getStudentProgressIds(s));
        const sRows = allRows.filter((r) => progressIds.has(r.user_id));
        const todayRow = sRows.find((r) => r.date === todayStr);
        const todayPercent = todayRow ? getDayProgress(todayRow) : 0;
        const weekActiveDays = sRows.filter((r) => getDayProgress(r) > STREAK_THRESHOLD).length;
        if (sRows.length > 0) {
          console.log(`[Übersicht] ${s.display_name}: ${sRows.length} Tage gefunden, heute=${todayPercent}%, aktiveTage=${weekActiveDays}`);
        } else {
          console.warn(`[Übersicht] ${s.display_name}: KEINE Daten gefunden! progressIds=`, Array.from(progressIds));
        }
        return { studentId: s.student_id, name: s.display_name, todayPercent, weekActiveDays };
      });

      const totalBlitzeCalculated = students.reduce((sum, s) => sum + Number(s.points || 0), 0);
      console.log("[Übersicht] totalBlitzeCalculated (aus Schülerprofilen):", totalBlitzeCalculated);
      console.log("[Übersicht] Stats berechnet:", stats.length, "Schüler");

      stats.sort((a, b) => b.todayPercent - a.todayPercent || b.weekActiveDays - a.weekActiveDays);
      setStudentStats(stats);

      const days: DayStat[] = daysOfWeek.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const activeCount = students.filter((s) => {
          const progressIds = new Set(getStudentProgressIds(s));
          return allRows.some((r) => r.date === dateStr && progressIds.has(r.user_id) && getDayProgress(r) > STREAK_THRESHOLD);
        }).length;
        return {
          date: dateStr,
          label: format(day, "EEE", { locale: de }),
          activeCount,
          totalCount: students.length,
        };
      });
      setDayStats(days);
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadTeacherTodayDbData = async () => {
    if (!teacherId) return;
    const today = format(new Date(), "yyyy-MM-dd");
    console.log("[Teacher] loadTeacherTodayDbData — userId:", teacherId, "date:", today);
    const { data, error } = await supabase
      .from("daily_results")
      .select("push_ups, squats, planks, sit_ups, jumping_jacks")
      .eq("user_id", teacherId)
      .eq("date", today)
      .maybeSingle();
    console.log("[Teacher] daily_results from DB:", data, "error:", error);
    setTeacherTodayDbData({
      push_ups: data?.push_ups || 0,
      squats: data?.squats || 0,
      planks: data?.planks || 0,
      sit_ups: data?.sit_ups || 0,
      jumping_jacks: data?.jumping_jacks || 0,
    });
  };

  const loadTeacherPoints = async () => {
    if (!teacherId) return;
    console.log("[Teacher] loadTeacherPoints — userId:", teacherId);
    const { data, error } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", teacherId)
      .maybeSingle();
    console.log("[Teacher] profile.points from DB:", data?.points, "error:", error);
    setTeacherPoints(data?.points ?? 0);
  };

  // Process localStorage exercise results written by camera counters and save them to the DB.
  // Called on mount whenever authMode + teacherId are resolved, so results are captured even
  // when the counter redirected through /dashboard (which re-routes teachers to /teacher-home).
  useEffect(() => {
    if (authMode !== "supabase" || !teacherId) return;

    const processResults = async () => {
      type ExerciseField = keyof typeof DAILY_EXERCISE_GOALS;
      const EXERCISE_KEYS: { storageKey: string; dbField: ExerciseField; max: number }[] = [
        { storageKey: "pushups_result",      dbField: "push_ups",      max: 200 },
        { storageKey: "squats_result",       dbField: "squats",        max: 300 },
        { storageKey: "planks_result",       dbField: "planks",        max: 600 },
        { storageKey: "situps_result",       dbField: "sit_ups",       max: 300 },
        { storageKey: "jumpingjacks_result", dbField: "jumping_jacks", max: 500 },
      ];

      const incoming: Partial<Record<ExerciseField, number>> = {};
      let hasIncoming = false;

      for (const { storageKey, dbField, max } of EXERCISE_KEYS) {
        const raw = localStorage.getItem(storageKey);
        if (raw !== null) {
          const value = parseInt(raw, 10);
          if (!isNaN(value) && value > 0 && value <= max) {
            incoming[dbField] = value;
            hasIncoming = true;
          }
          localStorage.removeItem(storageKey);
        }
      }
      // Always clean up the return-path marker set before counter navigation
      localStorage.removeItem("boost_return_path");

      // Always load teacher's points so the Wertung and mitmachen tabs show up-to-date data
      void loadTeacherPoints();

      if (!hasIncoming) return;

      console.log("[Teacher] Processing exercise results — userId:", teacherId, "incoming:", incoming);

      const today = format(new Date(), "yyyy-MM-dd");
      const { data: existing } = await supabase
        .from("daily_results")
        .select("push_ups, squats, planks, sit_ups, jumping_jacks")
        .eq("user_id", teacherId)
        .eq("date", today)
        .maybeSingle();

      const prev: Record<ExerciseField, number> = {
        push_ups:      existing?.push_ups      ?? 0,
        squats:        existing?.squats        ?? 0,
        planks:        existing?.planks        ?? 0,
        sit_ups:       existing?.sit_ups       ?? 0,
        jumping_jacks: existing?.jumping_jacks ?? 0,
      };

      const updated: Record<ExerciseField, number> = {
        push_ups:      prev.push_ups      + (incoming.push_ups      ?? 0),
        squats:        prev.squats        + (incoming.squats        ?? 0),
        planks:        prev.planks        + (incoming.planks        ?? 0),
        sit_ups:       prev.sit_ups       + (incoming.sit_ups       ?? 0),
        jumping_jacks: prev.jumping_jacks + (incoming.jumping_jacks ?? 0),
      };

      console.log("[Teacher] Saving daily_results:", { user_id: teacherId, date: today, ...updated });

      const { error: saveError } = await supabase
        .from("daily_results")
        .upsert({ user_id: teacherId, date: today, ...updated }, { onConflict: "user_id,date" });

      if (saveError) {
        console.error("[Teacher] Save error:", saveError);
        toast.error("Fehler beim Speichern der Übungen");
        return;
      }

      // Award per-exercise completion points
      const totalExercises = Object.keys(DAILY_EXERCISE_GOALS).length;
      const prevDone = countCompletedDailyExercises(prev);
      const newDone  = countCompletedDailyExercises(updated);
      const completionDelta = Math.max(0, newDone - prevDone);

      if (completionDelta > 0) {
        const pointsToAdd = completionDelta * BOOST_POINT_RULES.exerciseCompleted;
        console.log("[Teacher] Awarding exercise points:", pointsToAdd);
        const { error: pointsError } = await supabase.rpc("increment_points", { points_to_add: pointsToAdd });
        if (pointsError) {
          console.error("[Teacher] increment_points error:", pointsError);
          toast.error("Ergebnis gespeichert, Blitze konnten nicht gutgeschrieben werden.");
        } else {
          toast.success(`+${pointsToAdd} ⚡ gutgeschrieben!`);
        }
      }

      // Award daily-completion bonus when all exercises are newly done (teachers have no step requirement)
      if (prevDone < totalExercises && newDone === totalExercises) {
        console.log("[Teacher] All exercises done, awarding daily bonus:", BOOST_POINT_RULES.dailyGoalCompleted);
        const { error: bonusError } = await supabase.rpc("increment_points", { points_to_add: BOOST_POINT_RULES.dailyGoalCompleted });
        if (!bonusError) {
          toast.success(`+${BOOST_POINT_RULES.dailyGoalCompleted} ⚡ Alle Übungen geschafft!`);
        } else {
          console.error("[Teacher] Daily bonus error:", bonusError);
        }
      }

      void loadTeacherTodayDbData();
      void loadTeacherPoints();
      setActiveTab("mitmachen");
    };

    void processResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authMode, teacherId]);

  const loadRanking = async () => {
    setRankingLoading(true);
    try {
      const studentIds = Array.from(new Set(students.flatMap(getStudentProgressIds)));
      console.log("[Wertung] studentIds für Ranking:", studentIds);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, points")
        .in("id", studentIds)
        .order("points", { ascending: false });

      if (error || !data) {
        console.warn("[Wertung] profiles-Abfrage fehlgeschlagen, nutze Fallback (students.points):", error);
        setStudentRanks(students.map((s) => ({ id: s.student_id, name: s.display_name, points: Number(s.points || 0) })));
        return;
      }
      console.log("[Wertung] profiles geladen:", data.length, "Einträge");

      // Merge with students list for display names (profiles might have different names)
      const rankMap = new Map(data.map((p: { id: string; username: string; points: number }) => [p.id, p]));
      const ranks: StudentRank[] = students
        .map((s) => {
          const profile = rankMap.get(getPrimaryProgressId(s)) || rankMap.get(s.student_id);
          return {
            id: s.student_id,
            name: profile?.username || s.display_name,
            points: Number(profile?.points ?? s.points ?? 0),
          };
        })
        .sort((a, b) => b.points - a.points);
      setStudentRanks(ranks);
    } finally {
      setRankingLoading(false);
    }
  };

  const updateExercise = (field: keyof TeacherProgress, delta: number) => {
    setTeacherProgress((prev) => {
      const cap = field === "steps" ? DAILY_STEP_GOAL * 2 : (DAILY_EXERCISE_GOALS[field as keyof typeof DAILY_EXERCISE_GOALS] ?? 99) * 2;
      const next = { ...prev, [field]: Math.max(0, Math.min(cap, prev[field] + delta)) };
      if (teacherId) {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        localStorage.setItem(teacherStorageKey(teacherId, todayStr), JSON.stringify(next));
      }
      return next;
    });
  };

  const handleSubmitFeedback = async () => {
    const message = feedbackMessage.trim();
    if (message.length < 3) {
      toast.error("Bitte schreibe kurz, worum es geht.");
      return;
    }
    setSendingFeedback(true);
    try {
      const isCodeLogin = authMode === "code" && codeSession;
      const { data, error } = await (supabase.rpc as any)("submit_feedback", {
        p_message: message,
        p_rating: feedbackRating,
        p_page: "teacher-home",
        p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        p_device_id: isCodeLogin ? codeSession.device_id : null,
        p_session_token: isCodeLogin ? codeSession.session_token : null,
      });
      if (error) throw error;

      const result = data as Record<string, unknown> | null;
      if (result?.error) throw new Error(String(result.error));

      setFeedbackMessage("");
      setFeedbackRating(5);
      setFeedbackOpen(false);
      toast.success("Feedback gespeichert. Danke!");
    } catch (error) {
      console.error("Feedback submission failed:", error);
      toast.error("Feedback konnte nicht gespeichert werden.");
    } finally {
      setSendingFeedback(false);
    }
  };

  const feedbackRatingLabel = feedbackRating === 1
    ? "Gefällt wenig"
    : feedbackRating === 5
      ? "Mega App"
      : `${feedbackRating} von 5`;

  const handleApproveStudent = async (studentId: string, status: "accepted" | "rejected") => {
    try {
      const { error } = await (supabase.rpc as any)("update_student_approval_auth", {
        p_student_id: studentId,
        p_status: status,
      });
      if (error) { toast.error("Fehler: " + error.message); return; }
      setPendingStudents((prev) => prev.filter((s) => s.student_id !== studentId));
      toast.success(status === "accepted" ? "Schüler:in angenommen." : "Schüler:in abgelehnt.");
    } catch (err: any) {
      toast.error("Fehler: " + (err?.message ?? "Unbekannt"));
    }
  };

  const handleSaveClassAssignment = async () => {
    if (!assignSchoolId || !assignClassId) {
      toast.error("Bitte Schule und Klasse auswählen.");
      return;
    }
    setAssignLoading(true);
    try {
      const { error } = await (supabase.rpc as any)("save_teacher_class_assignment_auth", {
        p_school_id: assignSchoolId,
        p_class_id: assignClassId,
      });
      if (error) { toast.error("Fehler: " + error.message); return; }
      const school = availableSchools.find((s) => s.id === assignSchoolId);
      const cls = availableClasses.find((c) => c.id === assignClassId);
      if (school && cls) {
        setTeacherClassAssignments((prev) => {
          const exists = prev.some((a) => a.class_id === assignClassId);
          if (exists) return prev;
          return [...prev, { id: crypto.randomUUID(), school_id: assignSchoolId, school_name: school.name, class_id: assignClassId, class_name: cls.name }];
        });
      }
      setAssignSchoolId("");
      setAssignClassId("");
      toast.success("Klasse übernommen.");
      // Reload pending students in case some already exist
      const { data } = await (supabase.rpc as any)("get_pending_students_for_teacher_auth");
      if (Array.isArray(data)) setPendingStudents(data as PendingStudent[]);
    } catch (err: any) {
      toast.error("Fehler: " + (err?.message ?? "Unbekannt"));
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveClassAssignment = async (classId: string) => {
    try {
      const { error } = await (supabase.rpc as any)("remove_teacher_class_assignment_auth", { p_class_id: classId });
      if (error) { toast.error("Fehler: " + error.message); return; }
      setTeacherClassAssignments((prev) => prev.filter((a) => a.class_id !== classId));
      toast.success("Klasse entfernt.");
    } catch (err: any) {
      toast.error("Fehler: " + (err?.message ?? "Unbekannt"));
    }
  };

  const renderMitmachenTab = () => {
    const todayLabel = format(new Date(), "EEEE, d. MMMM", { locale: de });

    // ── Supabase-auth: camera-based challenges (1:1 wie Schüler) ──
    if (authMode === "supabase") {
      const completedCount = countCompletedDailyExercises(teacherTodayDbData);
      const totalExercises = Object.keys(DAILY_EXERCISE_GOALS).length;
      const progressPct = Math.round((completedCount / totalExercises) * 100);

      const cameraExercises = [
        {
          key: "jumping_jacks", title: "Hampelmänner",
          progress: teacherTodayDbData.jumping_jacks, goal: DAILY_EXERCISE_GOALS.jumping_jacks,
          unit: "Wdh.", counterPath: "/jumping-jacks-counter.html",
          icon: <JumpingJacksIcon className="h-5 w-5" />,
          iconClass: "bg-amber-500/15 text-amber-500",
          progressClass: "bg-amber-400 shadow-[0_4px_12px_rgba(251,191,36,0.32)]",
          cardCompleteClass: "bg-amber-50/60",
        },
        {
          key: "push_ups", title: "Push-ups",
          progress: teacherTodayDbData.push_ups, goal: DAILY_EXERCISE_GOALS.push_ups,
          unit: "Wdh.", counterPath: "/pushup-counter.html",
          icon: <PushUpIcon className="h-5 w-5" />,
          iconClass: "bg-sky-500/15 text-sky-500",
          progressClass: "bg-sky-400 shadow-[0_4px_12px_rgba(56,189,248,0.32)]",
          cardCompleteClass: "bg-sky-50/60",
        },
        {
          key: "squats", title: "Kniebeugen",
          progress: teacherTodayDbData.squats, goal: DAILY_EXERCISE_GOALS.squats,
          unit: "Wdh.", counterPath: "/squat-counter.html",
          icon: <SquatIcon className="h-5 w-5" />,
          iconClass: "bg-orange-500/15 text-orange-500",
          progressClass: "bg-emerald-400 shadow-[0_4px_12px_rgba(52,211,153,0.35)]",
          cardCompleteClass: "bg-neutral-100",
        },
        {
          key: "planks", title: "Planks",
          progress: teacherTodayDbData.planks, goal: DAILY_EXERCISE_GOALS.planks,
          unit: "Sek.", counterPath: "/plank-timer.html",
          icon: <PlankIcon className="h-5 w-5" />,
          iconClass: "bg-cyan-500/15 text-cyan-500",
          progressClass: "bg-cyan-400 shadow-[0_4px_12px_rgba(34,211,238,0.32)]",
          cardCompleteClass: "bg-cyan-50/60",
        },
        {
          key: "sit_ups", title: "Sit-ups",
          progress: teacherTodayDbData.sit_ups, goal: DAILY_EXERCISE_GOALS.sit_ups,
          unit: "Wdh.", counterPath: "/situp-counter.html",
          icon: <SitUpIcon className="h-5 w-5" />,
          iconClass: "bg-fuchsia-500/15 text-fuchsia-500",
          progressClass: "bg-fuchsia-500 shadow-[0_4px_12px_rgba(217,70,239,0.3)]",
          cardCompleteClass: "bg-fuchsia-50/60",
        },
      ];

      return (
        <div className="space-y-4">
          <Card className="overflow-hidden rounded-[28px] border-0 bg-[linear-gradient(135deg,#22c55e_0%,#14b8a6_54%,#38bdf8_100%)] p-5 text-white shadow-[0_20px_44px_rgba(34,197,94,0.22)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{todayLabel}</p>
            <h2 className="mt-1 text-2xl font-black leading-tight">Tägliche Challenge</h2>
            <div className="mt-4 flex items-end gap-4">
              <div>
                <p className="text-5xl font-black leading-none">{progressPct}%</p>
                <p className="mt-1 text-sm font-semibold text-white/80">{completedCount} von {totalExercises} Übungen erledigt</p>
              </div>
              <div className="flex-1">
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/25">
                  <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-white/20 pt-3">
              <Zap className="h-4 w-4 fill-yellow-300 text-yellow-300" />
              <span className="text-xl font-black">
                {teacherPoints === null ? "…" : teacherPoints}
              </span>
              <span className="text-sm font-semibold text-white/70">Blitze gesamt</span>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {cameraExercises.map((task) => {
              const isComplete = task.progress >= task.goal;
              const progressPercent = Math.min(100, Math.round((task.progress / task.goal) * 100));
              return (
                <Card
                  key={task.key}
                  className={`overflow-hidden rounded-[20px] border p-0 shadow-[0_12px_26px_rgba(0,0,0,0.07),inset_0_-2px_0_rgba(0,0,0,0.04)] ${
                    isComplete ? `border-primary/15 ${task.cardCompleteClass}` : "border-black/5 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("boost_return_path", "/teacher-home");
                      window.location.href = task.counterPath;
                    }}
                    className="flex w-full flex-col items-start gap-2 p-3 text-left"
                  >
                    <div className="flex w-full items-start gap-2">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] ${task.iconClass}`}>
                        {task.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate pr-1 text-[13px] font-black leading-tight text-foreground">{task.title}</h3>
                          <div className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                            isComplete ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                          }`}>
                            {isComplete ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : `${progressPercent}%`}
                          </div>
                        </div>
                        <p className="text-[10px] font-black text-foreground/80">
                          {task.progress} / {task.goal} <span className="font-semibold text-foreground/55">{task.unit}</span>
                        </p>
                        <div className="mt-1.5 w-full">
                          <div className="relative h-2.5 overflow-hidden rounded-full bg-white/95 shadow-[inset_0_1px_2px_rgba(15,23,42,0.1)]">
                            <div className={`h-full rounded-full ${task.progressClass}`} style={{ width: `${progressPercent}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }

    // ── Code-auth: manuelle Eingabe ──
    const exerciseDone = countCompletedDailyExercises({
      push_ups: teacherProgress.push_ups,
      squats: teacherProgress.squats,
      planks: teacherProgress.planks,
      sit_ups: teacherProgress.sit_ups,
      jumping_jacks: teacherProgress.jumping_jacks,
    });
    const stepsDone = teacherProgress.steps >= DAILY_STEP_GOAL ? 1 : 0;
    const totalDone = exerciseDone + stepsDone;
    const totalTasks = Object.keys(DAILY_EXERCISE_GOALS).length + 1;
    const progressPct = Math.round((totalDone / totalTasks) * 100);

    const exercises: {
      field: keyof Omit<TeacherProgress, "steps">;
      label: string;
      icon: React.ReactNode;
      goal: number;
      unit: string;
      step: number;
    }[] = [
      { field: "push_ups", label: "Liegestütze", icon: <PushUpIcon />, goal: DAILY_EXERCISE_GOALS.push_ups, unit: "×", step: 1 },
      { field: "squats", label: "Kniebeugen", icon: <SquatIcon />, goal: DAILY_EXERCISE_GOALS.squats, unit: "×", step: 1 },
      { field: "planks", label: "Plank", icon: <PlankIcon />, goal: DAILY_EXERCISE_GOALS.planks, unit: "s", step: 5 },
      { field: "sit_ups", label: "Sit-Ups", icon: <SitUpIcon />, goal: DAILY_EXERCISE_GOALS.sit_ups, unit: "×", step: 5 },
      { field: "jumping_jacks", label: "Hampelmänner", icon: <JumpingJacksIcon />, goal: DAILY_EXERCISE_GOALS.jumping_jacks, unit: "×", step: 5 },
    ];

    return (
      <div className="space-y-4">
        <Card className="overflow-hidden rounded-[28px] border-0 bg-[linear-gradient(135deg,#22c55e_0%,#14b8a6_54%,#38bdf8_100%)] p-5 text-white shadow-[0_20px_44px_rgba(34,197,94,0.22)]">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{todayLabel}</p>
          <h2 className="mt-1 text-2xl font-black leading-tight">Tägliche Challenge</h2>
          <div className="mt-4 flex items-end gap-4">
            <div>
              <p className="text-5xl font-black leading-none">{progressPct}%</p>
              <p className="mt-1 text-sm font-semibold text-white/80">{totalDone} von {totalTasks} Aufgaben erledigt</p>
            </div>
            <div className="flex-1">
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {exercises.map(({ field, label, icon, goal, unit, step }) => {
            const current = teacherProgress[field];
            const done = current >= goal;
            return (
              <Card
                key={field}
                className={`rounded-[20px] border-black/5 p-4 shadow-[0_8px_18px_rgba(0,0,0,0.06)] transition ${
                  done ? "bg-primary/8 border-primary/30" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-muted">{icon}</div>
                  {done && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white">✓</span>}
                </div>
                <p className="mt-2 text-sm font-black text-foreground leading-tight">{label}</p>
                <p className="text-xs font-semibold text-muted-foreground">{current} / {goal} {unit}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={() => updateExercise(field, -step)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-black text-muted-foreground active:scale-95">−</button>
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full transition-all duration-300 ${done ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${Math.min(100, Math.round((current / goal) * 100))}%` }} />
                  </div>
                  <button type="button" onClick={() => updateExercise(field, step)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-white active:scale-95">+</button>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className={`rounded-[20px] border-black/5 p-4 shadow-[0_8px_18px_rgba(0,0,0,0.06)] ${teacherProgress.steps >= DAILY_STEP_GOAL ? "bg-primary/8 border-primary/30" : "bg-white"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-muted">
                <Footprints className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-black text-foreground">Schritte</p>
                <p className="text-xs font-semibold text-muted-foreground">{teacherProgress.steps.toLocaleString("de")} / {DAILY_STEP_GOAL.toLocaleString("de")}</p>
              </div>
            </div>
            {teacherProgress.steps >= DAILY_STEP_GOAL && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white">✓</span>}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={() => updateExercise("steps", -500)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-black text-muted-foreground active:scale-95">−</button>
            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full transition-all duration-300 ${teacherProgress.steps >= DAILY_STEP_GOAL ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${Math.min(100, Math.round((teacherProgress.steps / DAILY_STEP_GOAL) * 100))}%` }} />
            </div>
            <button type="button" onClick={() => updateExercise("steps", 500)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-white active:scale-95">+</button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">+500 Schritte pro Tipp</p>
        </Card>
      </div>
    );
  };

  // ── Render helpers ──────────────────────────────────────────

  const renderClassSelector = () => {
    if (classes.length <= 1) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {classes.map((cls) => (
          <button
            key={cls.class_id}
            type="button"
            onClick={() => setSelectedClassId(cls.class_id)}
            className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
              cls.class_id === selectedClassId
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cls.class_name}
          </button>
        ))}
      </div>
    );
  };

  const renderHomeTab = () => (
    <>
      <Card className="overflow-hidden rounded-[28px] border-0 bg-[linear-gradient(135deg,#22c55e_0%,#14b8a6_54%,#38bdf8_100%)] p-5 text-white shadow-[0_20px_44px_rgba(34,197,94,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge className="border-0 bg-white/18 text-white hover:bg-white/18">
              BOOST Verwaltung
            </Badge>
            <h2 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight">
              Willkommen
              <br />
              im Lehrerbereich
            </h2>
            <p className="mt-3 max-w-md text-sm font-semibold leading-relaxed text-white/82">
              Behalte deine Klassen im Blick und öffne die Verwaltung, wenn du Schüler:innen, QR-Codes oder Geräte bearbeiten möchtest.
            </p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            <Users className="h-8 w-8" />
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Card className="rounded-[20px] border-black/5 bg-white p-3 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
          <Users className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-1 text-xl font-black">{loading ? "..." : classes.length}</p>
          <p className="text-[11px] font-bold text-muted-foreground">Klassen</p>
        </Card>
        <Card className="rounded-[20px] border-black/5 bg-white p-3 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
          <ClipboardList className="mx-auto h-5 w-5 text-sky-500" />
          <p className="mt-1 text-xl font-black">{loading ? "..." : totalStudents}</p>
          <p className="text-[11px] font-bold text-muted-foreground">Schüler:innen</p>
        </Card>
        <Card className="rounded-[20px] border-black/5 bg-white p-3 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
          <QrCode className="mx-auto h-5 w-5 text-amber-500" />
          <p className="mt-1 text-xl font-black">QR</p>
          <p className="text-[11px] font-bold text-muted-foreground">Aktivierung</p>
        </Card>
      </div>

      <section className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground">Schnellzugriff</h2>
        </div>

        <button
          type="button"
          onClick={() => navigate("/teacher-management")}
          className="flex w-full items-center gap-4 rounded-[24px] border border-primary/15 bg-white p-4 text-left shadow-[0_14px_32px_rgba(0,0,0,0.07)] transition hover:border-primary/40"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-primary/12 text-primary">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-foreground">Verwaltung öffnen</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Schüler:innen hinzufügen, QR-Codes anzeigen, Geräte zurücksetzen.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="flex w-full items-center gap-4 rounded-[24px] border border-black/5 bg-white p-4 text-left shadow-[0_14px_32px_rgba(0,0,0,0.07)] transition hover:border-primary/20"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-primary/12 text-primary">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-foreground">Feedback senden</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Idee, Problem oder Wunsch mitteilen.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {classes.map((cls) => (
          <button
            key={cls.class_id}
            type="button"
            onClick={() => { setSelectedClassId(cls.class_id); setActiveTab("uebersicht"); }}
            className="flex w-full items-center gap-3 rounded-[20px] border border-black/5 bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-foreground">Klasse {cls.class_name}</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">{cls.school_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{cls.student_count}</Badge>
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}

        {!loading && classes.length === 0 && (
          <Card className="rounded-[20px] border-black/5 bg-white p-4 text-sm text-muted-foreground">
            Noch keine Klasse verfügbar. Öffne die Verwaltung, um deine erste Klasse vorzubereiten.
          </Card>
        )}
      </section>

      {/* ── Meine Klassen (supabase auth only) ───────────────── */}
      {authMode === "supabase" && (
        <section className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-foreground">Meine Klassen</h2>
          </div>

          {teacherClassAssignments.length > 0 ? (
            <div className="space-y-2">
              {teacherClassAssignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-[18px] border border-black/5 bg-white px-4 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.05)]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-foreground">Klasse {a.class_name}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">{a.school_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveClassAssignment(a.class_id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-50 hover:text-red-500"
                    aria-label="Klasse entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Klasse zugewiesen.</p>
          )}

          {/* Add class assignment */}
          <Card className="rounded-[20px] border-black/5 bg-white p-4 shadow-[0_10px_24px_rgba(0,0,0,0.05)]">
            <p className="mb-3 text-sm font-black text-foreground">Klasse übernehmen</p>
            <div className="space-y-2">
              <select
                value={assignSchoolId}
                onChange={(e) => setAssignSchoolId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="">Schule auswählen…</option>
                {availableSchools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                value={assignClassId}
                onChange={(e) => setAssignClassId(e.target.value)}
                disabled={!assignSchoolId || assignClassesLoading}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">
                  {assignClassesLoading ? "Klassen werden geladen…" : !assignSchoolId ? "Bitte zuerst Schule wählen" : availableClasses.length > 0 ? "Klasse auswählen…" : "Keine Klassen vorhanden"}
                </option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleSaveClassAssignment()}
                disabled={assignLoading || !assignSchoolId || !assignClassId}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-black text-white disabled:opacity-50"
              >
                {assignLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Klasse übernehmen
              </button>
            </div>
          </Card>
        </section>
      )}

      {/* ── Schüler:innen freigeben (supabase auth only) ──────── */}
      {authMode === "supabase" && (pendingStudents.length > 0 || pendingStudentsLoading) && (
        <section className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-foreground">Schüler:innen freigeben</h2>
            {pendingStudents.length > 0 && (
              <Badge variant="destructive" className="text-xs">{pendingStudents.length}</Badge>
            )}
          </div>

          {pendingStudentsLoading ? (
            <div className="h-16 animate-pulse rounded-[20px] bg-muted" />
          ) : (
            <div className="space-y-2">
              {pendingStudents.map((s) => (
                <Card
                  key={s.assignment_id}
                  className="rounded-[20px] border-amber-100 bg-amber-50/60 p-4 shadow-[0_8px_18px_rgba(0,0,0,0.04)]"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-amber-500/15 text-amber-600">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-foreground">{s.username}</p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {s.school_name} · Klasse {s.class_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleApproveStudent(s.student_id, "accepted")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-sm font-black text-white"
                    >
                      <Check className="h-4 w-4" /> Annehmen
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApproveStudent(s.student_id, "rejected")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-black text-red-600"
                    >
                      Ablehnen
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );

  const renderUebersichtTab = () => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    if (studentsLoading || overviewLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[20px] bg-muted" />
          ))}
        </div>
      );
    }

    if (students.length === 0) {
      return (
        <Card className="rounded-[20px] border-black/5 bg-white p-4 text-sm text-muted-foreground">
          Für diese Klasse sind noch keine Schüler:innen aktiviert.
        </Card>
      );
    }

    const todayActiveCount = studentStats.filter((s) => s.todayPercent > ACTIVE_PROGRESS_THRESHOLD).length;
    const todayPct = students.length > 0
      ? Math.round((todayActiveCount / students.length) * 100)
      : 0;
    const weekPct = students.length > 0 && studentStats.length > 0
      ? Math.round(studentStats.reduce((s, x) => s + x.weekActiveDays, 0) / (students.length * 5) * 100)
      : 0;

    return (
      <div className="space-y-4">
        {renderClassSelector()}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-[20px] border-black/5 bg-white p-4 shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Heute aktiv</p>
            <p className="mt-1 text-3xl font-black text-foreground">{todayPct}%</p>
            <p className="text-xs font-semibold text-muted-foreground">
              {todayActiveCount} von {students.length} Schüler:innen
            </p>
          </Card>
          <Card className="rounded-[20px] border-black/5 bg-white p-4 shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ø Wochenleistung</p>
            <p className="mt-1 text-3xl font-black text-foreground">{weekPct}%</p>
            <p className="text-xs font-semibold text-muted-foreground">Ø Tagesziele erreicht</p>
          </Card>
        </div>

        {/* Weekly heatmap */}
        {dayStats.length > 0 && (
          <Card className="rounded-[20px] border-black/5 bg-white p-4 shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
            <p className="mb-3 text-sm font-black text-foreground">Wochenaktivität der Klasse</p>
            <div className="grid grid-cols-7 gap-1.5">
              {dayStats.map((day) => {
                const pct = day.totalCount > 0 ? Math.round((day.activeCount / day.totalCount) * 100) : 0;
                const isToday = day.date === todayStr;
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground">{day.label}</span>
                    <div
                      className={`flex h-10 w-full items-center justify-center rounded-xl text-[11px] font-black transition ${
                        isToday ? "ring-2 ring-primary ring-offset-1" : ""
                      } ${
                        pct >= 75 ? "bg-primary/85 text-white" :
                        pct >= 50 ? "bg-primary/50 text-foreground" :
                        pct >= 25 ? "bg-primary/20 text-foreground" :
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {pct}%
                    </div>
                    <span className="text-[9px] text-muted-foreground">{day.activeCount}/{day.totalCount}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground text-center">
              Prozent der Schüler:innen die &gt;90% des Tagesziels erreicht haben
            </p>
          </Card>
        )}

        {/* Student list */}
        <div className="space-y-2">
          <h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">Schüler:innen im Detail</h3>
          {studentStats.map((s) => (
            <Card key={s.studentId} className="rounded-[18px] border-black/5 bg-white px-4 py-3 shadow-[0_8px_18px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-foreground">{formatDisplayName(s.name)}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground">Heute</span>
                        <span className="text-[10px] font-black text-foreground">{s.todayPercent}%</span>
                      </div>
                      <Progress value={s.todayPercent} className="h-1.5" />
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground">Diese Woche</span>
                      <span className="text-[10px] font-black text-foreground">{s.weekActiveDays}/5 Tage</span>
                    </div>
                  </div>
                </div>
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    s.todayPercent >= 90
                      ? "bg-primary/15 text-primary"
                      : s.todayPercent >= 50
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.todayPercent}%
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderWertungTab = () => {
    if (studentsLoading || rankingLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-[18px] bg-muted" />
          ))}
        </div>
      );
    }

    if (students.length === 0) {
      return (
        <Card className="rounded-[20px] border-black/5 bg-white p-4 text-sm text-muted-foreground">
          Für diese Klasse sind noch keine Schüler:innen aktiviert.
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {renderClassSelector()}

        <Card className="rounded-[20px] border-black/5 bg-white p-4 shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-foreground">
                Klasse {selectedClass?.class_name ?? ""}
              </p>
              <p className="text-xs text-muted-foreground">{selectedClass?.school_name}</p>
            </div>
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>

          <div className="space-y-1.5">
            {studentRanks.map((student, i) => {
              const rank = i + 1;
              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between rounded-[14px] bg-muted/50 p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    {getRankBadge(rank)}
                    <span className="text-sm font-bold text-foreground">{formatDisplayName(student.name)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-black">{student.points}</span>
                    <Zap className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                  </div>
                </div>
              );
            })}

            {/* Teacher entry */}
            <div className="mt-2 flex items-center justify-between rounded-[14px] border border-primary/20 bg-primary/8 p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Medal className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-black text-primary">{teacherName}</span>
                  <Badge variant="outline" className="ml-2 border-primary/30 text-[10px] text-primary">
                    Lehrer:in
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {teacherPoints !== null && teacherPoints > 0 ? (
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-black text-primary">{teacherPoints}</span>
                    <Zap className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setActiveTab("mitmachen")}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary active:scale-95"
                >
                  Aktiv
                  <Zap className="h-3 w-3 fill-current" />
                </button>
              </div>
            </div>
          </div>

          <p className="mt-3 border-t border-border pt-3 text-[11px] text-center text-muted-foreground">
            Als Lehrer:in kannst du mit deiner Klasse mittrainieren — nutze den „Aktiv"-Tab.
          </p>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <header className="border-b border-border bg-background px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Lehrer Home</p>
            <h1 className="text-2xl font-black leading-tight text-foreground">{teacherName}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {activeTab === "home" && renderHomeTab()}
        {activeTab === "uebersicht" && renderUebersichtTab()}
        {activeTab === "wertung" && renderWertungTab()}
        {activeTab === "mitmachen" && renderMitmachenTab()}
      </main>

      <TeacherBottomNav active={activeTab} onTabChange={setActiveTab} />

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Feedback senden</DialogTitle>
            <DialogDescription>
              Schreib kurz, was verbessert werden soll oder wo etwas nicht passt.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-muted/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-foreground">Wie gefällt dir BOOST?</span>
              <span className="text-xs font-semibold text-muted-foreground">{feedbackRatingLabel}</span>
            </div>
            <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Feedback Bewertung">
              {[1, 2, 3, 4, 5].map((rating) => {
                const isActive = rating <= feedbackRating;

                return (
                  <button
                    key={rating}
                    type="button"
                    role="radio"
                    aria-checked={feedbackRating === rating}
                    aria-label={`${rating} von 5 Sternen`}
                    onClick={() => setFeedbackRating(rating)}
                    className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white"
                    disabled={sendingFeedback}
                  >
                    <Star className={`h-7 w-7 ${isActive ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/35"}`} />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between px-1 text-[11px] font-medium text-muted-foreground">
              <span>1 gefällt wenig</span>
              <span>5 Mega App</span>
            </div>
          </div>
          <Textarea
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            placeholder="Dein Feedback..."
            className="min-h-32 resize-none rounded-2xl"
            maxLength={1000}
          />
          <div className="text-right text-xs text-muted-foreground">
            {feedbackMessage.trim().length}/1000
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setFeedbackOpen(false)}
              disabled={sendingFeedback}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => void handleSubmitFeedback()}
              disabled={sendingFeedback || feedbackMessage.trim().length < 3}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendingFeedback ? "Sendet..." : "Senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
