import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Bell, Check, ChevronRight, Flame, Footprints, Play, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { endOfWeek, format, getISOWeek, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { BOOST_POINT_RULES, DAILY_EXERCISE_GOALS, DAILY_STEP_GOAL, countCompletedDailyExercises } from "@/lib/gamification";
import { ClassLeaderboard } from "@/components/boost/ClassLeaderboard";
import { JumpingJacksIcon, PlankIcon, PushUpIcon, SitUpIcon, SquatIcon, WalkingIcon } from "@/components/ExerciseIcons";
import { getDemoAwarePoints } from "@/lib/demo";
import { HealthService } from "@/services/healthService";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import voltUnder39Img from "@/assets/volt-under-39.png";
import volt39To59Img from "@/assets/volt-39-59.png";
import volt60To79Img from "@/assets/volt-60-79.png";
import volt80To89Img from "@/assets/volt-80-89.png";
import volt90PlusImg from "@/assets/volt-90-plus.png";
import { AVATAR_BASE_ASSET, AVATAR_ITEMS, AvatarItemId, loadEquippedAvatarItem } from "@/lib/avatarItems";

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
const STREAK_DAY_THRESHOLD_PERCENT = 90;

const Dashboard = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate("/");
          return;
        }

        setUserId(session.user.id);
        setEquippedAvatarItem(loadEquippedAvatarItem(session.user.id));

        const [{ data: roleData }, { data: profileData, error: profileError }] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .eq("role", "admin")
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("username, points, school, class")
            .eq("id", session.user.id)
            .single(),
        ]);

        const metaAccountType = String(session.user.user_metadata?.account_type || "").toLowerCase();
        setIsTeacher(!!roleData || metaAccountType === "teacher");

        if (profileError) {
          console.error("Error loading profile:", profileError);
          navigate("/");
          return;
        }

        if (!profileData) {
          console.error("No profile found for user:", session.user.id);
          navigate("/");
          return;
        }

        setUsername(profileData.username || "Spieler");
        setPoints(getDemoAwarePoints(profileData.points, session.user.email));
        setUserSchool(profileData.school || "");
        setUserClass(profileData.class || "");

        void loadWeeklyProgress(session.user.id);
      } catch (error) {
        console.error("Error loading dashboard:", error);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    void checkAuthAndLoadProfile();
  }, [navigate]);

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
    if (!userId || !HealthService.isHealthPlatformSupported()) return;

    const refreshHealthSteps = () => {
      void loadWeeklyProgress(userId);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshHealthSteps();
      }
    };

    window.addEventListener("focus", refreshHealthSteps);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = window.setInterval(refreshHealthSteps, 30000);

    return () => {
      window.removeEventListener("focus", refreshHealthSteps);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, [userId]);

  const getDayProgressPercent = (day?: WeeklyResult) => {
    if (!day) return 0;

    const steps = day.steps_tracking_active ? Number(day.steps || 0) : 0;
    const completedExerciseCount = countCompletedDailyExercises({
      jumping_jacks: day.jumping_jacks || 0,
      push_ups: day.push_ups || 0,
      squats: day.squats || 0,
      planks: day.planks || 0,
      sit_ups: day.sit_ups || 0,
    });
    const completedTaskCount = (steps >= DAILY_STEP_GOAL ? 1 : 0) + completedExerciseCount;
    const taskCount = Object.keys(DAILY_EXERCISE_GOALS).length + 1;

    return Math.min(100, Math.round((completedTaskCount / taskCount) * 100));
  };

  const isWeeklyStreakDay = (day: WeeklyResult) => getDayProgressPercent(day) > STREAK_DAY_THRESHOLD_PERCENT;

  const loadWeeklyProgress = async (currentUserId: string) => {
    const today = new Date();
    const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });
    
    const { data: weeklyData } = await supabase
      .from("daily_results")
      .select("*")
      .eq("user_id", currentUserId)
      .gte("date", format(weekStart, "yyyy-MM-dd"))
      .lte("date", format(weekEnd, "yyyy-MM-dd"));

    if (weeklyData) {
      setWeeklyData(weeklyData);
      const streakDays = weeklyData.filter(isWeeklyStreakDay).length;
      setWeeklyCompleted(streakDays);
      void syncTodayHealthSteps(currentUserId, weeklyData);
    }
  };

  const syncTodayHealthSteps = async (currentUserId: string, currentWeeklyData: WeeklyResult[]) => {
    if (!HealthService.isHealthPlatformSupported()) return;

    try {
      const realSteps = await HealthService.getTodaySteps();
      const todayDate = format(new Date(), "yyyy-MM-dd");
      const existingToday = currentWeeklyData.find((day) => day.date === todayDate);

      if (realSteps <= 0 && existingToday?.steps && !existingToday.steps_tracking_active) {
        return;
      }

      const payload = {
        steps: realSteps,
        steps_tracking_active: true,
        updated_at: new Date().toISOString(),
      };

      if (existingToday?.id) {
        const { error } = await supabase
          .from("daily_results")
          .update(payload)
          .eq("id", existingToday.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("daily_results")
          .insert({
            user_id: currentUserId,
            date: todayDate,
            ...payload,
            steps_started_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      const nextWeeklyData = existingToday
        ? currentWeeklyData.map((day) => (day.date === todayDate ? { ...day, ...payload } : day))
        : [...currentWeeklyData, { date: todayDate, steps: realSteps, steps_tracking_active: true, jumping_jacks: 0, push_ups: 0, squats: 0, planks: 0, sit_ups: 0 }];

      setWeeklyData(nextWeeklyData);
      setWeeklyCompleted(nextWeeklyData.filter(isWeeklyStreakDay).length);
    } catch (error) {
      console.error("Dashboard health step sync failed:", error);
    }
  };

  const today = new Date();
  const calendarWeek = getISOWeek(today);
  const todayKey = format(today, "yyyy-MM-dd");
  const todayResult = weeklyData.find((day) => day.date === todayKey);
  const todaySteps = todayResult?.steps_tracking_active ? Number(todayResult.steps || 0) : 0;
  const todayStepsSyncedAt = todayResult?.steps_tracking_active && todayResult.updated_at
    ? format(new Date(todayResult.updated_at), "HH:mm")
    : null;
  const completedExerciseCount = todayResult
    ? countCompletedDailyExercises({
        jumping_jacks: todayResult.jumping_jacks || 0,
        push_ups: todayResult.push_ups || 0,
        squats: todayResult.squats || 0,
        planks: todayResult.planks || 0,
        sit_ups: todayResult.sit_ups || 0,
      })
    : 0;
  const dailyProgressPercent = getDayProgressPercent(todayResult);
  const estimatedMovementMinutes = Math.max(0, Math.round((todaySteps / 1000) * 4 + completedExerciseCount * 3));
  const voltMoods = [
    {
      key: "inaktiv",
      min: 0,
      title: "Volt ist inaktiv.",
      copy: "Erledige eine Aufgabe, damit dein Buddy wieder Energie bekommt.",
      label: "Inaktiv",
      image: voltUnder39Img,
    },
    {
      key: "bereit",
      min: 39,
      title: "Volt ist bereit!",
      copy: "Du bist gut gestartet. Jetzt fehlt nicht mehr viel.",
      label: "Bereit",
      image: volt39To59Img,
    },
    {
      key: "aktiv",
      min: 60,
      title: "Volt ist aktiv!",
      copy: "Dein Buddy sammelt Energie und bleibt mit dir dran.",
      label: "Aktiv",
      image: volt60To79Img,
    },
    {
      key: "aufgeladen",
      min: 80,
      title: "Volt ist aufgeladen!",
      copy: "Starker Fortschritt. Dein Tagesziel ist fast geschafft.",
      label: "Aufgeladen",
      image: volt80To89Img,
    },
    {
      key: "mega-boost",
      min: 90,
      title: "Volt im Mega Boost!",
      copy: "Mega Tag. Volt ist voll da und wächst mit dir.",
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
      unit: "Schritte",
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
        <div className="mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] space-y-4">
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

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <div className="relative mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top)+0.25rem)]">
        <button
          type="button"
          className="absolute right-4 top-[calc(env(safe-area-inset-top)+0.25rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-foreground shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="mb-5 flex items-center gap-3 pr-12">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]">
            <img src={AVATAR_BASE_ASSET} alt="Avatar" className="h-full w-full object-contain" />
            {equippedAvatarItem !== "none" && AVATAR_ITEMS[equippedAvatarItem] && (
              <img
                src={AVATAR_ITEMS[equippedAvatarItem].asset}
                alt={AVATAR_ITEMS[equippedAvatarItem].name}
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[1.9rem] font-black leading-none tracking-tight text-foreground">
              Hi {username} 👋
            </h1>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-muted-foreground">
              Schön, dass du da bist!
              <span className="inline-flex items-center gap-0.5 font-bold text-primary">
                {points}
                <Zap className="h-3.5 w-3.5 fill-current" />
              </span>
            </p>
          </div>
        </div>

        <div className="mb-4 overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_28%_78%,rgba(50,255,236,0.45)_0%,transparent_32%),linear-gradient(135deg,#075cff_0%,#078cff_48%,#16c7e9_100%)] text-white shadow-[0_18px_34px_rgba(0,83,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]">
          <div className="relative grid h-[34vh] min-h-[13.5rem] max-h-[16.5rem] grid-cols-[minmax(0,1fr)_42%] overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_22%,rgba(255,255,255,0.32)_0_1px,transparent_2px),radial-gradient(circle_at_52%_20%,rgba(255,255,255,0.5)_0_2px,transparent_3px),radial-gradient(circle_at_33%_38%,rgba(255,255,255,0.24)_0_1px,transparent_2px)]" />
            <div className="relative flex items-center justify-center overflow-hidden px-1 py-4">
              <div className="absolute bottom-8 h-8 w-36 rounded-full border-4 border-cyan-200/70 shadow-[0_0_24px_rgba(103,232,249,0.82),inset_0_0_16px_rgba(103,232,249,0.4)]" />
              <div className="absolute left-3 top-9 hidden h-28 w-6 rounded-full border border-cyan-200/50 bg-cyan-200/10 shadow-[0_0_18px_rgba(103,232,249,0.5)] sm:block">
                <div className="absolute bottom-2 left-1/2 h-16 w-2.5 -translate-x-1/2 rounded-full bg-cyan-200/85 shadow-[0_0_16px_rgba(103,232,249,0.95)]" />
                <span className="absolute -right-9 bottom-1 text-[9px] font-black text-white/85">Lv.1</span>
                <span className="absolute -right-9 bottom-[3.4rem] text-[9px] font-black text-white/85">Lv.2</span>
                <span className="absolute -right-9 top-0 text-[9px] font-black text-white/85">Lv.3</span>
              </div>
              <img
                src={activeVoltMood.image}
                alt={`Volt Status: ${activeVoltMood.label}`}
                className="relative z-10 h-[12.75rem] w-[12.75rem] object-contain drop-shadow-[0_18px_24px_rgba(0,30,120,0.24)] transition-all duration-700"
              />
            </div>

            <div className="relative z-10 flex flex-col justify-between px-3 py-4">
              <div>
                <p className="mb-1.5 inline-flex rounded-full bg-white/16 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/90 backdrop-blur">
                  {activeVoltMood.label}
                </p>
                <h2 className="text-[1.38rem] font-black leading-tight tracking-tight">
                  {activeVoltMood.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm font-medium leading-snug text-white/90">
                  {activeVoltMood.copy}
                </p>
              </div>
              <div className="mt-2 flex justify-center">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-cyan-200/24 shadow-[inset_0_0_0_8px_rgba(255,255,255,0.12),0_0_24px_rgba(34,211,238,0.3)]">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(rgb(103 232 249) 0% ${dailyProgressPercent}%, rgba(255,255,255,0.18) ${dailyProgressPercent}% 100%)`,
                    }}
                  />
                  <div className="relative flex h-[3.9rem] w-[3.9rem] flex-col items-center justify-center rounded-full bg-blue-600/75 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                    <p className="text-[1.35rem] font-black leading-none">{dailyProgressPercent}%</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-white/86">Ziel</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_16px_34px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="flex min-w-0 flex-col items-center justify-center gap-2 px-2 py-4 text-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
              <Footprints className="h-5 w-5" />
            </div>
            <div className="min-w-0 max-w-full">
              <p className="text-[1.05rem] font-black leading-none text-foreground">{todaySteps.toLocaleString("de-DE")}</p>
              <p className="mt-1 text-[11px] font-semibold leading-tight text-muted-foreground">Schritte</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-2 border-x border-black/6 px-2 py-4 text-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0 max-w-full">
              <p className="text-[1.05rem] font-black leading-none text-foreground">{estimatedMovementMinutes} <span className="text-[0.75rem]">Min</span></p>
              <p className="mt-1 text-[11px] font-semibold leading-tight text-muted-foreground">Bewegung</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-2 px-2 py-4 text-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
              <Flame className="h-5 w-5 fill-orange-500" />
            </div>
            <div className="min-w-0 max-w-full">
              <p className="text-[1.05rem] font-black leading-none text-foreground">{weeklyCompleted} <span className="text-[0.75rem]">Tage</span></p>
              <p className="mt-1 text-[11px] font-semibold leading-tight text-muted-foreground">Streaks</p>
            </div>
          </div>
        </div>
        <p className="mb-5 text-center text-[11px] font-semibold text-muted-foreground">
          {todayStepsSyncedAt
            ? `Apple Health zuletzt synchronisiert: ${todaySteps.toLocaleString("de-DE")} Schritte um ${todayStepsSyncedAt}`
            : "Apple Health noch nicht synchronisiert"}
        </p>
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
                  className={`overflow-hidden rounded-[20px] border p-0 shadow-[0_12px_26px_rgba(0,0,0,0.07),inset_0_-2px_0_rgba(0,0,0,0.04)] ${
                    isComplete
                      ? `border-primary/15 ${task.cardCompleteClass}`
                      : "border-black/5 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => navigate("/challenge/daily")}
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
                          <div className="mt-1 flex items-center justify-between text-[9px] font-semibold text-foreground/55">
                            <span>{progressPercent}% erreicht</span>
                            <span>{task.goal} {task.unit}</span>
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
        <button
          type="button"
          onClick={() => navigate("/challenge/weekly/athlete")}
          className="mb-4 block w-full text-left"
        >
          <Card className="overflow-hidden rounded-[24px] border-0 bg-transparent p-0 shadow-none">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-base font-black leading-none text-foreground">Motivation der Woche</h2>
              <span className="flex items-center gap-1 text-sm font-black text-primary">
                +{BOOST_POINT_RULES.weeklyChallengeCompleted}
                <Zap className="h-3.5 w-3.5 fill-current" />
              </span>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-white/45 bg-[linear-gradient(135deg,hsl(var(--primary)/0.24)_0%,hsl(var(--primary)/0.5)_100%)] shadow-[0_22px_44px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-3px_0_rgba(0,0,0,0.08)]">
              <div className="relative">
                <div className="relative aspect-[16/8.5]">
                  <img
                    src={weeklyImg}
                    alt="Wochen-Quest Video"
                    className="h-full w-full object-cover opacity-15 mix-blend-multiply"
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-950">
                    Neu · KW {calendarWeek}
                  </div>
                  <div className="absolute right-3 top-3 rounded-lg bg-primary/80 px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                    So 23:58
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-primary text-primary-foreground shadow-[0_16px_28px_rgba(0,0,0,0.16),inset_0_-2px_0_rgba(0,0,0,0.08)]">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 rounded-lg bg-primary/80 px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                    2:48
                  </div>
                </div>

                <div className="border-t border-black/5 bg-primary/50 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                  <p className="text-lg font-black leading-tight text-zinc-950">
                    "So bleibe ich dran, wenn ich keinen Bock habe."
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-950">Anna Gasser</p>
                  <p className="text-xs text-zinc-900/70">Snowboard-Olympiasiegerin</p>
                </div>
              </div>
            </div>
          </Card>
        </button>

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
