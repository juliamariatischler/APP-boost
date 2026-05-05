import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Crown, Play, Star, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { eachDayOfInterval, endOfWeek, format, getISOWeek, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { BOOST_POINT_RULES, DAILY_EXERCISE_GOALS, DAILY_STEP_GOAL, WEEKLY_GOAL_DAYS, countCompletedDailyExercises, isDailyGoalComplete } from "@/lib/gamification";
import { ClassLeaderboard } from "@/components/boost/ClassLeaderboard";
import { JumpingJacksIcon, PlankIcon, PushUpIcon, SitUpIcon, SquatIcon, WalkingIcon } from "@/components/ExerciseIcons";
import { getDemoAwarePoints } from "@/lib/demo";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import { AVATAR_BASE_ASSET, AVATAR_ITEMS, AvatarItemId, loadEquippedAvatarItem } from "@/lib/avatarItems";

type WeeklyResult = {
  date: string;
  jumping_jacks: number | null;
  push_ups: number | null;
  squats: number | null;
  planks: number | null;
  sit_ups: number | null;
  steps: number | null;
};

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
  const [weeklyTotal] = useState(WEEKLY_GOAL_DAYS);
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

  const hasAnyActivity = (day: WeeklyResult) => {
    return (
      (day.steps || 0) > 0 ||
      (day.jumping_jacks || 0) > 0 ||
      (day.push_ups || 0) > 0 ||
      (day.squats || 0) > 0 ||
      (day.planks || 0) > 0 ||
      (day.sit_ups || 0) > 0
    );
  };

  const getDailyBlitze = (day?: WeeklyResult) => {
    if (!day) return 0;

    const completedExercises = countCompletedDailyExercises({
      jumping_jacks: day.jumping_jacks || 0,
      push_ups: day.push_ups || 0,
      squats: day.squats || 0,
      planks: day.planks || 0,
      sit_ups: day.sit_ups || 0,
    });

    let total = completedExercises * BOOST_POINT_RULES.exerciseCompleted;

    if (
      isDailyGoalComplete(day.steps || 0, {
        jumping_jacks: day.jumping_jacks || 0,
        push_ups: day.push_ups || 0,
        squats: day.squats || 0,
        planks: day.planks || 0,
        sit_ups: day.sit_ups || 0,
      })
    ) {
      total += BOOST_POINT_RULES.dailyGoalCompleted;
    }

    return total;
  };

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
      const daysWithActivity = weeklyData.filter(hasAnyActivity).length;
      setWeeklyCompleted(daysWithActivity);
    }
  };

  const today = new Date();
  const calendarWeek = getISOWeek(today);
  const daysOfWeek = eachDayOfInterval({
    start: startOfWeek(today, { locale: de, weekStartsOn: 1 }),
    end: endOfWeek(today, { locale: de, weekStartsOn: 1 }),
  });
  const activeDates = weeklyData
    .filter(hasAnyActivity)
    .map((day) => day.date)
    .sort((a, b) => a.localeCompare(b));
  const starredActiveDate = weeklyCompleted === WEEKLY_GOAL_DAYS - 1 ? activeDates[WEEKLY_GOAL_DAYS - 2] : null;
  const weeklyChallengeCompletedDate = weeklyCompleted >= WEEKLY_GOAL_DAYS ? activeDates[WEEKLY_GOAL_DAYS - 1] : null;
  const todayKey = format(today, "yyyy-MM-dd");
  const todayResult = weeklyData.find((day) => day.date === todayKey);
  const dailyTasks = [
    {
      key: "steps",
      title: "Schritte",
      progress: Number(todayResult?.steps || 0),
      goal: DAILY_STEP_GOAL,
      unit: "Schritte",
      reward: BOOST_POINT_RULES.dailyGoalCompleted,
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
      <div className="mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]">
              <img src={AVATAR_BASE_ASSET} alt="Avatar" className="h-full w-full object-contain" />
              {equippedAvatarItem !== "none" && AVATAR_ITEMS[equippedAvatarItem] && (
                <img
                  src={AVATAR_ITEMS[equippedAvatarItem].asset}
                  alt={AVATAR_ITEMS[equippedAvatarItem].name}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
            </div>
            <div>
              <p className="text-[18px] font-semibold text-muted-foreground">Hi</p>
              <h1 className="mt-1 text-[2.1rem] font-black leading-none tracking-tight text-primary">
                {username}
              </h1>
            </div>
          </div>
          <div className="rounded-[22px] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <p className="flex items-center gap-1 text-2xl font-black text-foreground">
              {points}
              <Zap className="h-5 w-5 fill-primary text-primary" />
            </p>
          </div>
        </div>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <h2 className="text-base font-black leading-none text-foreground">Meine Woche</h2>
          <p className="text-sm font-bold text-foreground/80">
            {weeklyCompleted} von {weeklyTotal} Tagen aktiv
          </p>
        </div>
        <div className="mb-4 overflow-hidden rounded-[28px] border border-primary/35 bg-white px-4 py-4 text-foreground shadow-[0_20px_42px_rgba(31,224,102,0.14),0_10px_24px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.82)]">
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayResult = weeklyData.find((entry) => entry.date === dateKey);
              const isActive = activeDates.includes(dateKey);
              const isToday = dateKey === format(today, "yyyy-MM-dd");
              const showStreakStar = starredActiveDate === dateKey && isActive;
              const showWeeklyBadge = weeklyChallengeCompletedDate === dateKey;
              const dayBlitze = getDailyBlitze(dayResult);

              return (
                <div key={dateKey} className="flex flex-col items-center gap-1.5">
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-xs font-black uppercase text-foreground/55">
                      {format(day, "EE", { locale: de })}
                    </span>
                    <span className="mt-1 text-[11px] font-semibold text-foreground/35">
                      {format(day, "d.")}
                    </span>
                  </div>
                  <div
                    className={`flex h-12 w-full items-center justify-center rounded-2xl border ${
                      showWeeklyBadge
                        ? "border-primary bg-primary text-primary-foreground"
                        : isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : isToday
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-black/8 bg-[#f3f5f8] text-black/25"
                    } ${isToday ? "ring-2 ring-primary/35 ring-offset-2 ring-offset-white" : ""}`}
                  >
                    {showWeeklyBadge ? (
                      <Crown className="h-5 w-5 fill-current" />
                    ) : showStreakStar ? (
                      <Star className="h-5 w-5 fill-current" />
                    ) : isActive ? (
                      <Check className="h-5 w-5 stroke-[3]" />
                    ) : null}
                  </div>
                  <div className="flex min-h-[16px] items-center gap-1 text-[11px] font-bold text-foreground/55">
                    {dayBlitze > 0 ? (
                      <>
                        <span>{dayBlitze}</span>
                        <Zap className="h-3 w-3 fill-warning text-warning" />
                      </>
                    ) : (
                      <span>•</span>
                    )}
                  </div>
                </div>
              );
            })}
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
