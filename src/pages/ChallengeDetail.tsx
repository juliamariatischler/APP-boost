import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/quest-friend-emoji.png";
import tryitImg from "@/assets/challenge-tryit.jpg";
import TrialSessionsList from "@/components/TrialSessionsList";
import { DailyChallengeContent } from "@/components/DailyChallengeContent";
import { TopHeader } from "@/components/TopHeader";
import { BottomNav } from "@/components/BottomNav";
import { CheckCircle2, MapPin, Play, Sparkles, Zap } from "lucide-react";
import { format, subDays } from "date-fns";
import { isDemoEmail } from "@/lib/demo";
import { BOOST_POINT_RULES } from "@/lib/gamification";
import { AVATAR_BASE_ASSET } from "@/lib/avatarItems";

const challengeData: Record<string, { title: string; image: string; description: string }> = {
  daily: {
    title: "Tägliche Challenge",
    image: dailyImg,
    description: "Kurze, kindgerechte Bewegungsimpulse mit reduzierten Wiederholungen und rotierendem Trainingsfokus. Unsere Übungen basieren auf internationalen Trainingsrichtlinien für Kinder und sind speziell auf Sicherheit, Einfachheit und Skalierbarkeit ausgelegt.",
  },
  weekly: {
    title: "Wochenmission",
    image: weeklyImg,
    description: `Schaffe 5 aktive Tage und hol dir +${BOOST_POINT_RULES.weeklyChallengeCompleted} Blitze.`,
  },
  friend: {
    title: "Friendquest Challenge",
    image: friendImg,
    description: "Fordere deine Freunde heraus und habt zusammen Spaß an der Bewegung!",
  },
  tryit: {
    title: "Try It Challenge",
    image: tryitImg,
    description: `Ein gemeinsames Try-It-System mit echten Sportarten, Vereinsnähe und +${BOOST_POINT_RULES.tryItCompleted} Blitzen pro neuem Erlebnis.`,
  },
};

const Blitz3D = ({ className = "" }: { className?: string }) => (
  <span className={`relative inline-flex shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(145deg,#baff76_0%,#61dc70_46%,#22a64a_100%)] text-white shadow-[0_9px_14px_rgba(31,224,102,0.34),0_3px_0_rgba(20,120,52,0.28),inset_0_2px_2px_rgba(255,255,255,0.68),inset_0_-3px_5px_rgba(0,0,0,0.18)] ${className}`}>
    <span className="absolute left-1.5 top-1 h-2 w-3 rounded-full bg-white/45 blur-[1px]" />
    <Zap className="relative h-[62%] w-[62%] fill-current drop-shadow-[0_2px_2px_rgba(0,0,0,0.24)]" />
  </span>
);

const QuestBuddy = ({ type }: { type: string }) => {
  const isTryIt = type === "tryit";

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <div className="absolute inset-2 rounded-[36px] bg-[radial-gradient(circle_at_36%_28%,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.72)_34%,rgba(97,220,112,0.16)_100%)] shadow-[0_18px_34px_rgba(31,224,102,0.20),inset_0_2px_0_rgba(255,255,255,0.85),inset_0_-4px_10px_rgba(0,0,0,0.08)]" />
      <div className="absolute right-0 top-2 h-9 w-9 rounded-full bg-[linear-gradient(145deg,#ffcf5a_0%,#ff8a3d_100%)] shadow-[0_8px_16px_rgba(249,115,22,0.28),inset_0_2px_0_rgba(255,255,255,0.65)]">
        <span className="absolute left-2 top-2 h-2 w-3 rounded-full bg-white/55 blur-[1px]" />
      </div>
      <div className="absolute left-2 top-5 h-5 w-10 -rotate-12 rounded-full border-2 border-white/80 bg-sky-300/80 shadow-[0_8px_14px_rgba(14,165,233,0.18)]" />
      {isTryIt && (
        <>
          <div className="absolute left-1 bottom-9 h-8 w-8 rounded-full bg-[linear-gradient(145deg,#ffffff_0%,#d9f99d_42%,#61dc70_100%)] shadow-[0_8px_16px_rgba(31,224,102,0.2),inset_0_2px_0_rgba(255,255,255,0.85)]">
            <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-primary/45" />
            <span className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-primary/45" />
          </div>
          <div className="absolute right-3 bottom-7 h-2 w-8 rotate-[-24deg] rounded-full bg-primary/35" />
          <div className="absolute right-7 bottom-4 h-2 w-7 rotate-[-10deg] rounded-full bg-primary/25" />
        </>
      )}
      <img
        src={AVATAR_BASE_ASSET}
        alt=""
        aria-hidden="true"
        className="relative z-10 h-[5.7rem] w-[5.7rem] object-contain drop-shadow-[0_14px_18px_rgba(15,23,42,0.18)]"
      />
      <div className="absolute bottom-2 right-4 z-20">
        <Blitz3D className="h-8 w-8 rotate-6" />
      </div>
    </div>
  );
};

const ChallengeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState(0);
  const [weeklyActiveDays, setWeeklyActiveDays] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserId(session.user.id);

    if (id === "weekly") {
      const today = new Date().toISOString().split("T")[0];
      const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");
      const demoUser = isDemoEmail(session.user.email);

      const { data, error } = await supabase
        .from("daily_results")
        .select("jumping_jacks, push_ups, squats, planks, sit_ups, steps")
        .eq("user_id", session.user.id)
        .gte("date", weekStart)
        .lte("date", today);

      if (!error && data) {
        const activeDays = data.filter((day) =>
          (day.steps || 0) > 0 ||
          (day.jumping_jacks || 0) > 0 ||
          (day.push_ups || 0) > 0 ||
          (day.squats || 0) > 0 ||
          (day.planks || 0) > 0 ||
          (day.sit_ups || 0) > 0
        ).length;
        const activeGoalDays = Math.min(activeDays, 5);
        const computedProgress = Math.round((activeGoalDays / 5) * 100);
        setWeeklyActiveDays(demoUser ? Math.max(2, activeGoalDays) : activeGoalDays);
        setWeeklyProgress(demoUser ? Math.max(40, computedProgress) : computedProgress);
      } else {
        setWeeklyActiveDays(demoUser ? 2 : 0);
        setWeeklyProgress(demoUser ? 40 : 0);
      }
    }
  };

  const challenge = id ? challengeData[id] : null;
  const headerReward =
    id === "tryit"
      ? BOOST_POINT_RULES.tryItCompleted
      : id === "friend"
      ? BOOST_POINT_RULES.friendQuestCompleted
      : BOOST_POINT_RULES.weeklyChallengeCompleted;

  if (!challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Challenge nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader />

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 pb-8">
        {id === "daily" && userId ? (
          <DailyChallengeContent userId={userId} />
        ) : (
          <Card className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-0 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.72)_0%,transparent_34%),linear-gradient(135deg,#8ee6ff_0%,#7ce582_48%,#fff3a3_100%)]">
              <div className="grid grid-cols-[minmax(0,1fr)_132px]">
                <div className="relative min-h-[13.5rem] overflow-hidden">
                  <img
                    src={challenge.image}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover opacity-58 mix-blend-multiply saturate-125"
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.46)_0%,transparent_32%),linear-gradient(90deg,rgba(15,23,42,0.34)_0%,rgba(15,23,42,0.08)_66%,rgba(255,255,255,0.72)_100%)]" />
                  <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-primary/45 blur-2xl" />
                  <div className="absolute bottom-4 right-5 h-9 w-9 rounded-full bg-yellow-300/75 shadow-[0_8px_18px_rgba(250,204,21,0.25)]" />
                  <div className="absolute left-5 top-5 rounded-full bg-white/22 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur">
                    {id === "tryit" ? "Ausprobieren" : "Quest"}
                  </div>
                  <div className="absolute bottom-5 left-5 right-6">
                    <h1 className="max-w-[12.5rem] text-[1.72rem] font-black leading-[0.95] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.28)]">
                      {challenge.title}
                    </h1>
                    <p className="mt-2 max-w-[13rem] text-sm font-bold leading-snug text-white/92">
                      {challenge.description}
                    </p>
                  </div>
                </div>

                <div className="relative flex flex-col items-center justify-center px-2 py-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_42%,rgba(255,255,255,0.86)_0%,rgba(255,255,255,0.48)_54%,transparent_84%)]" />
                  <QuestBuddy type={id || "weekly"} />
                  <p className="relative -mt-1 flex items-center gap-1 text-xs font-black text-foreground/70">
                    +{headerReward}
                    <Blitz3D className="h-6 w-6" />
                  </p>
                </div>
              </div>
            </div>

            {id === "weekly" && (
              <div className="p-5">
                <div className="mx-auto mb-6 max-w-xl rounded-[24px] bg-[#f7f9f3] p-5 text-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-sm font-black text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                    +{BOOST_POINT_RULES.weeklyChallengeCompleted} Blitze
                    <Blitz3D className="h-7 w-7" />
                  </div>
                  <p className="mt-4 text-2xl font-black text-foreground">Schaffe 5 aktive Tage</p>
                  <p className="mt-2 text-sm font-medium text-muted-foreground">Such dir eine Mission aus und sammle jeden Tag Bewegung.</p>
                  <div className="mt-4 rounded-[20px] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="mb-2 flex items-center justify-between text-sm font-black text-foreground">
                      <span>Dein Fortschritt</span>
                      <span>{weeklyActiveDays}/5 Tage</span>
                    </div>
                    <Progress value={weeklyProgress} className="h-3 rounded-full bg-black/8" />
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-foreground/65">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>{weeklyProgress >= 100 ? "Geschafft!" : "Jeder aktive Tag zaehlt"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => navigate("/challenge/weekly/athlete")}
                  className="rounded-[24px] border border-primary/20 bg-[linear-gradient(180deg,#ffffff_0%,#f6fff7_100%)] p-5 text-left transition hover:border-primary hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Mission 1</p>
                      <h3 className="mt-2 text-xl font-black text-foreground">Video-Mission</h3>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium text-muted-foreground">Schau ein Sportler-Video und mach mit.</p>
                  <div className="mt-4 space-y-2 text-sm font-semibold text-foreground">
                    <div className="rounded-2xl bg-white px-3 py-2">Video schauen</div>
                    <div className="rounded-2xl bg-white px-3 py-2">Challenge nachmachen</div>
                    <div className="rounded-2xl bg-white px-3 py-2">Blitze holen</div>
                  </div>
                  <p className="mt-4 text-sm font-black text-primary">Jetzt starten</p>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/challenge/weekly/geotracking")}
                  className="rounded-[24px] border border-sky-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4fbff_100%)] p-5 text-left transition hover:border-sky-400 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">Mission 2</p>
                      <h3 className="mt-2 text-xl font-black text-foreground">Schatzsuche</h3>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                      <MapPin className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium text-muted-foreground">Finde Orte draussen und sammle Funde.</p>
                  <div className="mt-4 space-y-2 text-sm font-semibold text-foreground">
                    <div className="rounded-2xl bg-white px-3 py-2">Rausgehen</div>
                    <div className="rounded-2xl bg-white px-3 py-2">Versteck finden</div>
                    <div className="rounded-2xl bg-white px-3 py-2">Fund eintragen</div>
                  </div>
                  <p className="mt-4 text-sm font-black text-sky-600">Jetzt starten</p>
                </button>
                </div>
                <div className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-foreground/70">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Such dir die Mission aus, die dir am meisten Spass macht.</span>
                </div>
              </div>
            )}

            {id !== "weekly" && (
              <div className="bg-white/66 px-5 py-4 backdrop-blur-[2px]" />
            )}

            {id === "tryit" && (
              <div className="px-5 pb-5">
                <TrialSessionsList />
              </div>
            )}
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ChallengeDetail;
