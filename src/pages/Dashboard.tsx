import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Clock3, Flame, MapPin, Sparkles, Target, Users, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { de } from "date-fns/locale";
import { LevelCard } from "@/components/boost/LevelCard";
import { BOOST_POINT_RULES, WEEKLY_GOAL_DAYS, getLevelForPoints } from "@/lib/gamification";
import { ClassLeaderboard } from "@/components/boost/ClassLeaderboard";
import { getDemoAwarePoints } from "@/lib/demo";
import boostLogo from "@/assets/boost-logo.png";
import dailyImg from "@/assets/challenge-daily.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";

type HomeQuestCard = {
  id: "daily" | "friend" | "tryit";
  title: string;
  eyebrow: string;
  description: string;
  reward: string;
  meta: string;
  image: string;
  icon: typeof Clock3;
};

const homeQuestCards: HomeQuestCard[] = [
  {
    id: "daily",
    title: "Tägliche Challenge",
    eyebrow: "TÄGLICH",
    description: "Heute reicht eine Übung oder dein Schrittziel, damit dein Fortschritt zählt.",
    reward: `1 Wdh. / 1 Sek. = ${BOOST_POINT_RULES.repOrSecond} ⚡`,
    meta: "5-10 Minuten",
    image: dailyImg,
    icon: Clock3,
  },
  {
    id: "friend",
    title: "Friendquest",
    eyebrow: "TEAM",
    description: "Fordere Freund:innen heraus und sammelt gemeinsam Bewegungspunkte.",
    reward: "Mehr Spaß zusammen",
    meta: "Gemeinsam spielen",
    image: friendImg,
    icon: Users,
  },
  {
    id: "tryit",
    title: "Try It",
    eyebrow: "NEU",
    description: "Teste eine neue Sportart, ein Training oder einen Verein in deiner Nähe.",
    reward: `+${BOOST_POINT_RULES.tryItCompleted} ⚡`,
    meta: "In deiner Nähe",
    image: tryitImg,
    icon: MapPin,
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [points, setPoints] = useState(0);
  const [userSchool, setUserSchool] = useState("");
  const [userClass, setUserClass] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [weeklyCompleted, setWeeklyCompleted] = useState(0);
  const [weeklyTotal] = useState(WEEKLY_GOAL_DAYS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate("/");
          return;
        }

        setUserId(session.user.id);

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
      const daysWithActivity = weeklyData.filter(day => 
        (day.jumping_jacks || 0) > 0 || 
        (day.push_ups || 0) > 0 || 
        (day.squats || 0) > 0 || 
        (day.planks || 0) > 0 || 
        (day.sit_ups || 0) > 0
      ).length;
      setWeeklyCompleted(daysWithActivity);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f4ee] pb-nav-safe">
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
    <div className="min-h-screen bg-[#f6f4ee] pb-nav-safe">
      <div className="mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <img src={boostLogo} alt="BOOST Logo" className="h-12 w-auto" />
            <p className="mt-3 text-sm font-medium text-primary">Hi {username}</p>
            <h1 className="text-[2rem] font-black leading-none tracking-tight text-foreground">
              Dein Boost
              <br />
              für heute
            </h1>
            <button
              type="button"
              onClick={() => navigate("/quests")}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
            >
              Alle Quests
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="rounded-[22px] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Blitze</p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-black text-foreground">
              {points}
              <Zap className="h-5 w-5 fill-primary text-primary" />
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/challenge/weekly")}
          className="mb-4 block w-full text-left"
        >
          <div className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#b9ff63_0%,#88dd34_100%)] p-5 shadow-[0_22px_60px_rgba(137,217,54,0.28)]">
            <div className="mb-8 flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  Wochen-Quest
                </span>
                <h2 className="mt-4 max-w-[12rem] text-4xl font-black leading-none text-zinc-950">
                  5 aktive
                  <br />
                  Tage
                </h2>
              </div>
              <span className="rounded-full bg-black/80 px-2.5 py-1 text-xs font-bold text-white">EPIC</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-black/80 p-3 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Belohnung</p>
                <p className="mt-1 flex items-center gap-1 text-lg font-black">
                  {BOOST_POINT_RULES.weeklyChallengeCompleted}
                  <Zap className="h-4 w-4 fill-current" />
                </p>
              </div>
              <div className="rounded-2xl bg-black/80 p-3 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Fortschritt</p>
                <p className="mt-1 text-lg font-black">{weeklyCompleted} / {weeklyTotal}</p>
              </div>
            </div>
          </div>
        </button>

        <div className="mb-4 rounded-[26px] bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4.5 w-4.5 text-primary" />
              <span className="text-sm font-bold text-foreground">Dein Fortschritt</span>
            </div>
            <span className="text-sm font-bold text-primary">
              {Math.round((weeklyCompleted / weeklyTotal) * 100)}%
            </span>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            {weeklyCompleted} von {weeklyTotal} aktiven Tagen diese Woche.
          </p>
          <Progress value={(weeklyCompleted / weeklyTotal) * 100} className="h-2.5" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Target, label: "Heute", value: "1 Wdh. = 1 ⚡" },
              { icon: Sparkles, label: "Bonus", value: `+${BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡` },
              { icon: ChevronRight, label: "Mehr", value: "Zu Quests" },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.label === "Mehr" ? "/quests" : "/challenge/daily")}
                  className="rounded-2xl bg-[#f7f7f1] px-3 py-3 text-left"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">{item.value}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <LevelCard points={points} level={getLevelForPoints(points)} />
        </div>

        {isTeacher && userSchool && userClass && (
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-bold text-foreground">Klassen-Leaderboard</h2>
            <ClassLeaderboard userClass={userClass} userSchool={userSchool} />
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Heute möglich</h2>
          <button
            type="button"
            onClick={() => navigate("/quests")}
            className="text-sm font-medium text-primary"
          >
            Quests
          </button>
        </div>
        {userId && (
          <div className="mb-6 space-y-3">
            {homeQuestCards.map((quest) => {
              const Icon = quest.icon;

              return (
                <Card
                  key={quest.id}
                  className="overflow-hidden rounded-[24px] border-border/70 bg-card/90 p-0 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/challenge/${quest.id}`)}
                    className="flex w-full items-stretch text-left"
                  >
                    <div className="w-28 shrink-0 bg-muted">
                      <img src={quest.image} alt={quest.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                            {quest.eyebrow}
                          </span>
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">{quest.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{quest.description}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-foreground">{quest.reward}</span>
                        <span className="text-xs text-muted-foreground">{quest.meta}</span>
                      </div>
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
