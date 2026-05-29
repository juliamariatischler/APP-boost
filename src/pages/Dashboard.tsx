import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Flame, RefreshCw, Play, Zap } from "lucide-react";
import { toast } from "sonner";
import { HealthService } from "@/services/healthService";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import {
  BOOST_POINT_RULES,
  DAILY_EXERCISE_GOALS,
  DAILY_STEP_GOAL,
  countCompletedDailyExercises,
  getDailyProgressPercent,
  isStreakEligibleDay,
  isDailyGoalComplete,
} from "@/lib/gamification";
import { ClassLeaderboard } from "@/components/boost/ClassLeaderboard";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { JumpingJacksIcon, PlankIcon, PushUpIcon, SitUpIcon, SquatIcon, WalkingIcon } from "@/components/ExerciseIcons";
import { getDemoAwarePoints, isDemoEmail } from "@/lib/demo";
import voltUnder39Img from "@/assets/volt-under-39.png";
import volt39To59Img from "@/assets/volt-39-59.png";
import volt60To79Img from "@/assets/volt-60-79.png";
import volt80To89Img from "@/assets/volt-80-89.png";
import volt90PlusImg from "@/assets/volt-90-plus.png";
import { AVATAR_BASE_ASSET, AVATAR_ITEMS, AvatarItemId, loadEquippedAvatarItem } from "@/lib/avatarItems";
import { getCurrentWeeklyVideo } from "@/lib/weeklyVideo";
import { getCodeStudentDashboard, saveCodeStudentCounterResults, type CodeSession } from "@/services/codeAuthService";
import { formatDisplayName } from "@/lib/formatName";

type WeeklyResult = {
  id?: string;
  date: string;
  jumping_jacks: number | null;
  push_ups: number | null;
  squats: number | null;
  planks: number | null;
  sit_ups: number | null;
  steps: number | null;
  steps_tracking_active?: boolean | null;
  updated_at?: string | null;
};

const STEP_TASK_REWARD = 5;
const COUNTER_STORAGE_KEYS = [
  { key: "jumpingjacks_result", dbKey: "jumping_jacks", max: 500 },
  { key: "squats_result", dbKey: "squats", max: 300 },
  { key: "situps_result", dbKey: "sit_ups", max: 300 },
  { key: "pushups_result", dbKey: "push_ups", max: 200 },
  { key: "planks_result", dbKey: "planks", max: 600 },
] as const;

const Dashboard = () => {
  const navigate = useNavigate();
  const { session: codeSession, loading: codeAuthLoading } = useCodeAuth();
  const [username, setUsername] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [points, setPoints] = useState(0);
  const [userSchool, setUserSchool] = useState("");
  const [userClass, setUserClass] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [weeklyCompleted, setWeeklyCompleted] = useState(0);
  const [weeklyData, setWeeklyData] = useState<WeeklyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [equippedAvatarItem, setEquippedAvatarItem] = useState<AvatarItemId>("none");
  const [stepsRefreshing, setStepsRefreshing] = useState(false);
  const pendingCounterProcessedRef = useRef(false);

  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      try {
        // Fast path: code-auth session is already resolved — skip the Supabase getSession round-trip
        if (!codeAuthLoading) {
          if (codeSession?.user_type === "teacher") {
            navigate("/teacher-home", { replace: true });
            return;
          }
          if (codeSession?.user_type === "student") {
            setUserId(codeSession.user_id);
            setUsername(codeSession.display_name || "Spieler");
            setPoints(Number(codeSession.points || 0));
            setUserSchool(codeSession.school_name || "");
            setUserClass(codeSession.class_name || "");
            setIsTeacher(false);
            setEquippedAvatarItem(loadEquippedAvatarItem(codeSession.user_id));
            void loadCodeStudentProgress(codeSession);
            setLoading(false);
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          if (codeAuthLoading) return;
          navigate("/");
          return;
        }

        // Fast path: metadata check avoids any DB call for teachers
        const metaAccountType = String(session.user.user_metadata?.account_type || "").toLowerCase();
        if (metaAccountType === "teacher") {
          navigate("/teacher-home", { replace: true });
          return;
        }

        const uid = session.user.id;
        setUserId(uid);
        setEquippedAvatarItem(loadEquippedAvatarItem(uid));

        // Kick off weekly progress fetch immediately — runs in parallel with profile queries
        void loadWeeklyProgress(uid, isDemoEmail(session.user.email));

        // Retry up to 4 times — new accounts may have a brief race condition
        // between session creation and the DB trigger creating the profile row.
        let profileData: { username: string | null; points: number | null; school: string | null; class: string | null } | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt));
          const { data } = await supabase
            .from("profiles")
            .select("username, points, school, class")
            .eq("id", uid)
            .maybeSingle();
          if (data) { profileData = data; break; }
        }

        const [{ data: adminRoleData }] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", uid)
            .eq("role", "admin")
            .maybeSingle(),
        ]);

        if (!profileData) {
          console.error("Profile not found after retries — signing out to prevent redirect loop");
          await supabase.auth.signOut();
          navigate("/auth", { replace: true });
          return;
        }

        // Redirect DB-role teachers (not caught by metadata check above)
        if (!!adminRoleData) {
          navigate("/teacher-home", { replace: true });
          return;
        }

        setIsTeacher(false);
        setUsername(profileData.username || "Spieler");
        setPoints(getDemoAwarePoints(profileData.points, session.user.email));
        setUserSchool(profileData.school || "");
        setUserClass(profileData.class || "");
      } catch (error) {
        console.error("Error loading dashboard:", error);
        navigate("/auth", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    void checkAuthAndLoadProfile();
  }, [codeAuthLoading, codeSession, navigate]);

  useEffect(() => {
    const handlePointsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ delta?: number }>;
      const delta = Number(customEvent.detail?.delta || 0);
      if (!delta) return;
      setPoints((prev) => prev + delta);
    };

    window.addEventListener("points-updated", handlePointsUpdated);
    return () => {
      window.removeEventListener("points-updated", handlePointsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const handleStorage = () => {
      setEquippedAvatarItem(loadEquippedAvatarItem(userId));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleStorage);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || pendingCounterProcessedRef.current) return;
    pendingCounterProcessedRef.current = true;
    void processPendingCounterResults(userId, codeSession?.user_type === "student" ? codeSession : null);
  }, [userId, codeSession]);

  const getDayProgressPercent = (day?: WeeklyResult) => getDailyProgressPercent(day);

  const isWeeklyStreakDay = (day: WeeklyResult) => isStreakEligibleDay(day);

  const loadWeeklyProgress = async (currentUserId: string, isDemo = false) => {
    const today = new Date();
    const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });

    const { data: rawData } = await supabase
      .from("daily_results")
      .select("*")
      .eq("user_id", currentUserId)
      .gte("date", format(weekStart, "yyyy-MM-dd"))
      .lte("date", format(weekEnd, "yyyy-MM-dd"));

    let finalData: WeeklyResult[] = rawData ?? [];

    if (isDemo) {
      const todayStr = format(today, "yyyy-MM-dd");
      const existingDates = new Set(finalData.map((r) => r.date));
      const d = new Date(weekStart);
      while (d <= today && d <= weekEnd) {
        const dateStr = format(d, "yyyy-MM-dd");
        if (!existingDates.has(dateStr)) {
          const isToday = dateStr === todayStr;
          finalData = [
            ...finalData,
            {
              date: dateStr,
              push_ups: 10,
              squats: 10,
              planks: 10,
              sit_ups: 25,
              jumping_jacks: 40,
              steps: isToday ? 0 : 3000,
              steps_tracking_active: !isToday,
            },
          ];
        }
        d.setDate(d.getDate() + 1);
      }
    }

    setWeeklyData(finalData);
    const streakDays = finalData.filter(isWeeklyStreakDay).length;
    setWeeklyCompleted(streakDays);
  };

  const loadCodeStudentProgress = async (session: CodeSession) => {
    const today = new Date();
    const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });

    try {
      const dashboard = await getCodeStudentDashboard(
        session,
        format(weekStart, "yyyy-MM-dd"),
        format(weekEnd, "yyyy-MM-dd")
      );
      const rows = dashboard.daily_results.map((row) => ({
        ...row,
        jumping_jacks: row.jumping_jacks ?? 0,
        push_ups: row.push_ups ?? 0,
        squats: row.squats ?? 0,
        planks: row.planks ?? 0,
        sit_ups: row.sit_ups ?? 0,
        steps: row.steps ?? 0,
      }));

      setPoints(dashboard.points);
      setWeeklyData(rows);
      setWeeklyCompleted(rows.filter(isWeeklyStreakDay).length);
    } catch (error) {
      console.error("Error loading code student dashboard:", error);
      setWeeklyData([]);
      setWeeklyCompleted(0);
    }
  };

  const awardFlashes = async (delta: number) => {
    if (delta <= 0) return false;

    const { error } = await supabase.rpc("increment_points", { points_to_add: delta });
    if (error) {
      console.error("Error awarding daily flashes from dashboard:", error);
      return false;
    }

    setPoints((prev) => prev + delta);
    window.dispatchEvent(new CustomEvent("points-updated", { detail: { delta } }));
    return true;
  };

  const syncDashboardSteps = async () => {
    if (!userId) return;

    // Code students: just reload their dashboard data from the DB
    if (codeSession?.user_type === "student") {
      setStepsRefreshing(true);
      try {
        await loadCodeStudentProgress(codeSession);
      } finally {
        setStepsRefreshing(false);
      }
      return;
    }

    if (!HealthService.isHealthPlatformSupported()) {
      toast.info("Schrittzähler ist nur in der mobilen App verfügbar.", {
        description: HealthService.getHealthSetupDescription(),
      });
      return;
    }

    setStepsRefreshing(true);
    try {
      const authorized = await HealthService.requestAuthorization();
      if (!authorized) {
        toast.error("Zugriff auf Schritte verweigert.", {
          description: "Bitte erlaube den Zugriff auf deine Schritte, damit BOOST deine Aktivität synchronisieren kann.",
        });
        return;
      }

      const todayStr = format(new Date(), "yyyy-MM-dd");

      // Ensure tracking is marked active for today
      const { data: existingRow } = await supabase
        .from("daily_results")
        .select("id, steps, steps_tracking_active")
        .eq("user_id", userId)
        .eq("date", todayStr)
        .maybeSingle();

      if (!existingRow?.steps_tracking_active) {
        if (existingRow) {
          await supabase
            .from("daily_results")
            .update({ steps_tracking_active: true, updated_at: new Date().toISOString() })
            .eq("id", existingRow.id);
        } else {
          await supabase
            .from("daily_results")
            .insert({ user_id: userId, date: todayStr, steps: 0, steps_tracking_active: true });
        }
      }

      const realSteps = await HealthService.getTodaySteps();

      if (realSteps === 0 && HealthService.isNativeAndroid()) {
        const help = await HealthService.getNoStepDataHelp();
        toast.info("Noch keine Schritte gefunden.", { description: help });
      }

      // Save step count to DB
      const { data: rowAfterActivation } = await supabase
        .from("daily_results")
        .select("id")
        .eq("user_id", userId)
        .eq("date", todayStr)
        .maybeSingle();

      if (rowAfterActivation) {
        await supabase
          .from("daily_results")
          .update({ steps: realSteps, updated_at: new Date().toISOString() })
          .eq("id", rowAfterActivation.id);
      }

      // Update local weeklyData immediately so UI reflects new count
      setWeeklyData((prev) => {
        const hasToday = prev.some((d) => d.date === todayStr);
        if (hasToday) {
          return prev.map((day) =>
            day.date === todayStr
              ? { ...day, steps: realSteps, steps_tracking_active: true }
              : day
          );
        }
        return [
          ...prev,
          {
            date: todayStr,
            steps: realSteps,
            steps_tracking_active: true,
            jumping_jacks: 0,
            push_ups: 0,
            squats: 0,
            planks: 0,
            sit_ups: 0,
          },
        ];
      });

      // Award flashes if the step goal was not yet met and is now met
      const prevSteps = Number(existingRow?.steps || 0);
      const prevActive = existingRow?.steps_tracking_active ?? false;
      const wasGoalMet = prevActive && prevSteps >= DAILY_STEP_GOAL;
      if (!wasGoalMet && realSteps >= DAILY_STEP_GOAL) {
        await awardFlashes(STEP_TASK_REWARD);
      }

      if (realSteps > 0) {
        toast.success(`${realSteps.toLocaleString("de-DE")} Schritte synchronisiert!`);
      }
    } catch (error) {
      console.error("Step sync error:", error);
      toast.error("Fehler beim Synchronisieren der Schritte.");
    } finally {
      setStepsRefreshing(false);
    }
  };

  const processPendingCounterResults = async (currentUserId: string, session: CodeSession | null) => {
    const pending: Partial<Record<(typeof COUNTER_STORAGE_KEYS)[number]["dbKey"], number>> = {};

    for (const item of COUNTER_STORAGE_KEYS) {
      const raw = localStorage.getItem(item.key);
      if (raw === null) continue;
      const value = Number.parseInt(raw, 10);
      if (Number.isFinite(value) && value >= 0 && value <= item.max) {
        pending[item.dbKey] = (pending[item.dbKey] || 0) + value;
      }
    }

    if (Object.keys(pending).length === 0) return;

    const todayStr = format(new Date(), "yyyy-MM-dd");

    if (session) {
      try {
        const result = await saveCodeStudentCounterResults(session, todayStr, pending);
        for (const item of COUNTER_STORAGE_KEYS) {
          localStorage.removeItem(item.key);
        }
        setPoints(result.total_points);
        if (result.points_awarded > 0) {
          window.dispatchEvent(new CustomEvent("points-updated", { detail: { delta: result.points_awarded } }));
        }
        await loadCodeStudentProgress(session);
      } catch (error) {
        console.error("Error saving code student counter results:", error);
      }
      return;
    }

    const { data: existingRow, error: existingError } = await supabase
      .from("daily_results")
      .select("jumping_jacks, push_ups, squats, planks, sit_ups, steps")
      .eq("user_id", currentUserId)
      .eq("date", todayStr)
      .maybeSingle();

    if (existingError) {
      console.error("Error loading existing daily result before counter import:", existingError);
      return;
    }

    const previous = {
      jumping_jacks: Number(existingRow?.jumping_jacks || 0),
      push_ups: Number(existingRow?.push_ups || 0),
      squats: Number(existingRow?.squats || 0),
      planks: Number(existingRow?.planks || 0),
      sit_ups: Number(existingRow?.sit_ups || 0),
    };
    const next = {
      jumping_jacks: previous.jumping_jacks + Number(pending.jumping_jacks || 0),
      push_ups: previous.push_ups + Number(pending.push_ups || 0),
      squats: previous.squats + Number(pending.squats || 0),
      planks: previous.planks + Number(pending.planks || 0),
      sit_ups: previous.sit_ups + Number(pending.sit_ups || 0),
    };

    const { error: saveError } = await supabase
      .from("daily_results")
      .upsert(
        {
          user_id: currentUserId,
          date: todayStr,
          ...next,
        },
        { onConflict: "user_id,date" }
      );

    if (saveError) {
      console.error("Error saving counter results from dashboard:", saveError);
      return;
    }

    for (const item of COUNTER_STORAGE_KEYS) {
      localStorage.removeItem(item.key);
    }

    const steps = Number(existingRow?.steps || 0);
    const completedDelta = Math.max(0, countCompletedDailyExercises(next) - countCompletedDailyExercises(previous));
    const dailyGoalDelta = !isDailyGoalComplete(steps, previous) && isDailyGoalComplete(steps, next)
      ? BOOST_POINT_RULES.dailyGoalCompleted
      : 0;
    const flashDelta = completedDelta * BOOST_POINT_RULES.exerciseCompleted + dailyGoalDelta;

    if (flashDelta > 0) {
      await awardFlashes(flashDelta);
    }

    await loadWeeklyProgress(currentUserId);
  };

  const today = new Date();
  const currentWeeklyVideo = getCurrentWeeklyVideo(today);
  const todayKey = format(today, "yyyy-MM-dd");
  const todayResult = weeklyData.find((day) => day.date === todayKey);
  const todaySteps = todayResult?.steps_tracking_active ? Number(todayResult.steps || 0) : 0;
  const completedExerciseCount = todayResult
    ? countCompletedDailyExercises({
      jumping_jacks: todayResult.jumping_jacks || 0,
      push_ups: todayResult.push_ups || 0,
      squats: todayResult.squats || 0,
      planks: todayResult.planks || 0,
      sit_ups: todayResult.sit_ups || 0,
    })
    : 0;
  const dailyTaskCount = Object.keys(DAILY_EXERCISE_GOALS).length + 1;
  const completedDailyTaskCount = (todaySteps >= DAILY_STEP_GOAL ? 1 : 0) + completedExerciseCount;
  const dailyProgressPercent = getDayProgressPercent(todayResult);
  const voltMoods = [
    {
      key: "inaktiv",
      min: 0,
      title: "Flash ist inaktiv.",
      copy: "Erledige eine Aufgabe, damit dein\nBuddy wieder Energie bekommt.",
      label: "Inaktiv",
      image: voltUnder39Img,
    },
    {
      key: "bereit",
      min: 39,
      title: "Flash ist bereit!",
      copy: "Du bist gut gestartet. Jetzt fehlt\nnicht mehr viel.",
      label: "Bereit",
      image: volt39To59Img,
    },
    {
      key: "aktiv",
      min: 60,
      title: "Flash ist aktiv!",
      copy: "Dein Buddy sammelt Energie\nund bleibt mit dir dran.",
      label: "Aktiv",
      image: volt60To79Img,
    },
    {
      key: "aufgeladen",
      min: 80,
      title: "Flash ist aufgeladen!",
      copy: "Starker Fortschritt. Dein\nTagesziel ist fast geschafft.",
      label: "Aufgeladen",
      image: volt80To89Img,
    },
    {
      key: "mega-boost",
      min: 90,
      title: "Flash im Mega Boost!",
      copy: "Mega Tag. Flash ist voll da\nund wächst mit dir.",
      label: "Mega Boost",
      image: volt90PlusImg,
    },
  ];
  const activeVoltMood = [...voltMoods].reverse().find((mood) => dailyProgressPercent >= mood.min) || voltMoods[0];
  const dailyTasks = [
    {
      key: "steps",
      title: "Schritte",
      progress: todaySteps,
      goal: DAILY_STEP_GOAL,
      unit: "S.",
      reward: STEP_TASK_REWARD,
      icon: <WalkingIcon className="h-5 w-5" />,
      iconClass: "bg-emerald-500/15 text-emerald-500",
      progressClass: "bg-emerald-400 shadow-[0_4px_12px_rgba(52,211,153,0.35)]",
      cardCompleteClass: "bg-emerald-50/60",
    },
    {
      key: "jumping_jacks",
      title: "Hampelmänner",
      progress: Number(todayResult?.jumping_jacks || 0),
      goal: DAILY_EXERCISE_GOALS.jumping_jacks,
      unit: "Wdh.",
      counterPath: "/jumping-jacks-counter.html",
      reward: BOOST_POINT_RULES.exerciseCompleted,
      icon: <JumpingJacksIcon className="h-5 w-5" />,
      iconClass: "bg-amber-500/15 text-amber-500",
      progressClass: "bg-amber-400 shadow-[0_4px_12px_rgba(251,191,36,0.32)]",
      cardCompleteClass: "bg-amber-50/60",
    },
    {
      key: "push_ups",
      title: "Push-ups",
      progress: Number(todayResult?.push_ups || 0),
      goal: DAILY_EXERCISE_GOALS.push_ups,
      unit: "Wdh.",
      counterPath: "/pushup-counter.html",
      reward: BOOST_POINT_RULES.exerciseCompleted,
      icon: <PushUpIcon className="h-5 w-5" />,
      iconClass: "bg-sky-500/15 text-sky-500",
      progressClass: "bg-sky-400 shadow-[0_4px_12px_rgba(56,189,248,0.32)]",
      cardCompleteClass: "bg-sky-50/60",
    },
    {
      key: "squats",
      title: "Kniebeugen",
      progress: Number(todayResult?.squats || 0),
      goal: DAILY_EXERCISE_GOALS.squats,
      unit: "Wdh.",
      counterPath: "/squat-counter.html",
      reward: BOOST_POINT_RULES.exerciseCompleted,
      icon: <SquatIcon className="h-5 w-5" />,
      iconClass: "bg-orange-500/15 text-orange-500",
      progressClass: "bg-emerald-400 shadow-[0_4px_12px_rgba(52,211,153,0.35)]",
      cardCompleteClass: "bg-neutral-100",
    },
    {
      key: "planks",
      title: "Planks",
      progress: Number(todayResult?.planks || 0),
      goal: DAILY_EXERCISE_GOALS.planks,
      unit: "Sek.",
      counterPath: "/plank-timer.html",
      reward: BOOST_POINT_RULES.exerciseCompleted,
      icon: <PlankIcon className="h-5 w-5" />,
      iconClass: "bg-cyan-500/15 text-cyan-500",
      progressClass: "bg-cyan-400 shadow-[0_4px_12px_rgba(34,211,238,0.32)]",
      cardCompleteClass: "bg-cyan-50/60",
    },
    {
      key: "sit_ups",
      title: "Sit-ups",
      progress: Number(todayResult?.sit_ups || 0),
      goal: DAILY_EXERCISE_GOALS.sit_ups,
      unit: "Wdh.",
      counterPath: "/situp-counter.html",
      reward: BOOST_POINT_RULES.exerciseCompleted,
      icon: <SitUpIcon className="h-5 w-5" />,
      iconClass: "bg-fuchsia-500/15 text-fuchsia-500",
      progressClass: "bg-fuchsia-500 shadow-[0_4px_12px_rgba(217,70,239,0.3)]",
      cardCompleteClass: "bg-fuchsia-50/60",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-nav-safe">
        <div className="mx-auto max-w-screen-xl px-4 pt-4 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-6 w-52 rounded-xl" />
          </div>
          <Skeleton className="h-52 w-full rounded-[28px]" />
          <Skeleton className="h-36 w-full rounded-[24px]" />
          <Skeleton className="h-28 w-full rounded-[24px]" />
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-[24px]" />
            <Skeleton className="h-32 w-full rounded-[24px]" />
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!username) return null;
  const displayUsername = formatDisplayName(username) || username;

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <div className="relative mx-auto max-w-screen-xl px-4 pt-[calc(0.25rem+0.4cm)]">
        <div className="mb-5 flex items-start gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]" style={{ transform: 'translateZ(0)' }}>
            <img src={AVATAR_BASE_ASSET} alt="Avatar" className="h-full w-full object-contain" />
            {equippedAvatarItem !== "none" && AVATAR_ITEMS[equippedAvatarItem] && (
              <img
                src={AVATAR_ITEMS[equippedAvatarItem].asset}
                alt={AVATAR_ITEMS[equippedAvatarItem].name}
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.9rem] font-black leading-none tracking-tight text-foreground">
              Hi {displayUsername} 👋
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Schön, dass du da bist!
            </p>
          </div>
          <div className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-black text-primary shadow-[0_10px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
            {points}
            <Zap className="h-4 w-4 fill-current" />
          </div>
        </div>

        <div className="mb-4 overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_28%_78%,rgba(50,255,236,0.45)_0%,transparent_32%),linear-gradient(135deg,#075cff_0%,#078cff_48%,#16c7e9_100%)] text-white shadow-[0_18px_34px_rgba(0,83,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]" style={{ transform: 'translateZ(0)' }}>
          <div className="relative grid h-[25vh] min-h-[16rem] max-h-[16rem] grid-cols-[minmax(0,1fr)_45%] overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_22%,rgba(255,255,255,0.32)_0_1px,transparent_2px),radial-gradient(circle_at_52%_20%,rgba(255,255,255,0.5)_0_2px,transparent_3px),radial-gradient(circle_at_33%_38%,rgba(255,255,255,0.24)_0_1px,transparent_2px)]" />
            <div className="relative flex flex-col items-center justify-center overflow-hidden px-1 py-4">
              <div className="absolute left-3 top-9 hidden h-22 w-6 rounded-full border border-cyan-200/50 bg-cyan-200/10 shadow-[0_0_18px_rgba(103,232,249,0.5)] sm:block">
                <div className="absolute bottom-2 left-1/2 h-16 w-2.5 -translate-x-1/2 rounded-full bg-cyan-200/85 shadow-[0_0_16px_rgba(103,232,249,0.95)]" />
                <span className="absolute -right-9 bottom-1 text-[9px] font-black text-white/85">Lv.1</span>
                <span className="absolute -right-9 bottom-[3.4rem] text-[9px] font-black text-white/85">Lv.2</span>
                <span className="absolute -right-9 top-0 text-[9px] font-black text-white/85">Lv.3</span>
              </div>
              <img
                src={activeVoltMood.image}
                alt={`Flash Status: ${activeVoltMood.label}`}
                className="relative z-10 h-[12.75rem] w-[12.75rem] -translate-y-[1.2rem] object-contain drop-shadow-[0_18px_24px_rgba(0,30,120,0.24)] transition-all duration-700"
              />
            </div>

            <div className="relative z-10 flex flex-col justify-between px-4 pt-3 pb-6">
              <div>
                <p className="mb-1.5 inline-flex rounded-full bg-white/16 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/90 backdrop-blur">
                  {activeVoltMood.label}
                </p>
                <h2 className="text-[1.45rem] font-black leading-tight tracking-tight">
                  {activeVoltMood.title}
                </h2>
              </div>
              <div className="flex justify-center">
                <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-cyan-200/24 shadow-[inset_0_0_0_9px_rgba(255,255,255,0.12),0_0_28px_rgba(34,211,238,0.34)]">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(rgb(103 232 249) 0% ${dailyProgressPercent}%, rgba(255,255,255,0.18) ${dailyProgressPercent}% 100%)`,
                    }}
                  />
                  <div className="relative flex h-[4rem] w-[4rem] flex-col items-center justify-center rounded-full bg-blue-600/75 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                    <p className="text-[1.45rem] font-black leading-none">{dailyProgressPercent}%</p>
                    <p className="mt-1 text-[11px] font-bold text-white/88">Ziel</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="absolute bottom-[0.75rem] left-0 z-20 w-full whitespace-pre-line px-4 text-left text-[0.75rem] font-bold leading-snug text-white/90">
              {activeVoltMood.copy}
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_16px_34px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
          <button
            type="button"
            onClick={syncDashboardSteps}
            disabled={stepsRefreshing}
            className="flex min-w-0 flex-col items-center justify-center gap-1.5 px-2 py-2 text-center w-full transition-opacity active:opacity-60"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
              <RefreshCw className={`h-4 w-4 ${stepsRefreshing ? "animate-spin" : ""}`} />
            </div>
            <div className="min-w-0 max-w-full">
              <p className="text-[1.05rem] font-black leading-none text-foreground">{todaySteps.toLocaleString("de-DE")}</p>
              <p className="mt-1 text-[11px] font-semibold leading-tight text-muted-foreground">Schritte</p>
            </div>
          </button>
          <div className="flex min-w-0 flex-col items-center justify-center gap-1.5 border-x border-black/6 px-2 py-2 text-center">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <div className="min-w-0 max-w-full">
              <p className="text-[1.05rem] font-black leading-none text-foreground">{completedDailyTaskCount}/{dailyTaskCount}</p>
              <p className="mt-1 text-[11px] font-semibold leading-tight text-muted-foreground">Aufgaben erledigt</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-1.5 px-2 py-2 text-center">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
              <Flame className="h-4 w-4 fill-orange-500" />
            </div>
            <div className="min-w-0 max-w-full">
              <p className="text-[1.05rem] font-black leading-none text-foreground">{weeklyCompleted} <span className="text-[0.8rem]">Tage</span></p>
              <p className="mt-1 text-[11px] font-semibold leading-tight text-muted-foreground">Streaks</p>
            </div>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black leading-none text-foreground">Heutige Aufgaben</h2>
          <button
            type="button"
            onClick={() => navigate("/quests")}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          >
            Quests
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {userId && (
          <div className="mb-6 grid grid-cols-2 gap-2">
            {dailyTasks.map((task) => {
              const isComplete = task.progress >= task.goal;
              const progressPercent = Math.min(100, Math.round((task.progress / task.goal) * 100));

              return (
                <Card
                  key={task.key}
                  className={`overflow-hidden rounded-[20px] border p-0 shadow-[0_12px_26px_rgba(0,0,0,0.07),inset_0_-2px_0_rgba(0,0,0,0.04)] ${isComplete
                      ? `border-primary/15 ${task.cardCompleteClass}`
                      : "border-black/5 bg-white"
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (task.counterPath) {
                        window.location.href = task.counterPath;
                      }
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
                          <div className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${isComplete ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                            }`}>
                            {isComplete ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : `${progressPercent}%`}
                          </div>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black text-foreground/80">
                            {task.progress} / {task.goal} <span className="font-semibold text-foreground/55">{task.unit}</span>
                          </p>
                          <p className="shrink-0 text-[9px] font-bold text-primary/75">
                            +{task.reward} ⚡
                          </p>
                        </div>
                        <div className="mt-1.5 w-full">
                          <div className="relative h-2.5 overflow-hidden rounded-full bg-white/95 shadow-[inset_0_1px_2px_rgba(15,23,42,0.1)]">
                            <div
                              className={`h-full rounded-full ${task.progressClass}`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-[9px] font-semibold text-foreground/55">
                            <span className="whitespace-nowrap">{progressPercent}% erreicht</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        )}
        <div className="mb-4 block w-full cursor-default select-none grayscale opacity-75">
          <Card className="overflow-hidden rounded-[24px] border-0 bg-transparent p-0 shadow-none">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-base font-black leading-none text-foreground">Motivation der Woche</h2>
              <span className="flex items-center gap-1 text-sm font-black text-primary">
                +{BOOST_POINT_RULES.weeklyChallengeCompleted}
                <Zap className="h-3.5 w-3.5 fill-current" />
              </span>
            </div>

            <div className="relative overflow-hidden rounded-[24px] border border-white/45 bg-[linear-gradient(135deg,hsl(var(--primary)/0.24)_0%,hsl(var(--primary)/0.5)_100%)] shadow-[0_22px_44px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-3px_0_rgba(0,0,0,0.08)]">
              <div className="relative">
                <div className="relative aspect-[16/8.5]">
                  <img
                    src={currentWeeklyVideo.image}
                    alt={currentWeeklyVideo.title}
                    className="h-full w-full object-cover opacity-35 mix-blend-multiply"
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-950">
                    Neu · {currentWeeklyVideo.weekKey}
                  </div>
                  <div className="absolute bottom-3 right-3 rounded-lg bg-primary/80 px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                    {currentWeeklyVideo.duration}
                  </div>
                </div>

                <div className="border-t border-black/5 bg-primary/50 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                  <p className="text-lg font-black leading-tight text-zinc-950">
                    "{currentWeeklyVideo.quote}"
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-950">{currentWeeklyVideo.speakerName}</p>
                  <p className="text-xs text-zinc-900/70">{currentWeeklyVideo.speakerLabel}</p>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-10 top-10 w-44 rotate-[38deg] bg-[#a0a0a0] py-1.5 text-center text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
                  COMING SOON
                </div>
              </div>
            </div>
          </Card>
        </div>

        {isTeacher && userSchool && userClass && (
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-bold text-foreground">Klassen-Leaderboard</h2>
            <ClassLeaderboard userClass={userClass} userSchool={userSchool} />
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
