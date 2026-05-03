import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, MapPin, Sparkles, Users, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";
import { BOOST_POINT_RULES } from "@/lib/gamification";

type QuestCard = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  reward: string;
  meta: string;
  image: string;
  icon: typeof Clock3;
};

const quests: QuestCard[] = [
  {
    id: "weekly",
    title: "Wochen-Quest",
    eyebrow: "EPIC",
    description: "5 aktive Tage schaffen und dir die Wochenbelohnung sichern.",
    reward: `+${BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡`,
    meta: "Endet Sonntag 23:59",
    image: weeklyImg,
    icon: Sparkles,
  },
  {
    id: "daily",
    title: "Tägliche Challenge",
    eyebrow: "TÄGLICH",
    description: "Heute reicht eine Übung oder dein Schrittziel, damit dein Fortschritt zählt.",
    reward: `+${BOOST_POINT_RULES.exerciseCompleted} bis +${BOOST_POINT_RULES.dailyGoalCompleted} ⚡`,
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

const Quests = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", session.user.id)
        .single();

      setUsername(profile?.username || "Spieler");
      setLoading(false);
    };

    void loadProfile();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader />

      <div className="mx-auto max-w-screen-xl px-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-52 rounded-xl" />
            <Skeleton className="h-52 w-full rounded-[28px]" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-sm font-medium text-primary">Hi {username}</p>
              <h1 className="text-3xl font-black tracking-tight text-foreground">Deine Quests</h1>
              <p className="mt-1 text-sm text-muted-foreground">Wähle eine Challenge und sammle heute neue Blitze.</p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/challenge/weekly")}
              className="mb-6 block w-full text-left"
            >
              <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#b9ff63_0%,#85df2f_100%)] p-5 shadow-[0_20px_60px_rgba(137,217,54,0.28)]">
                <div className="mb-8 flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                      Wochen-Quest
                    </span>
                    <h2 className="mt-4 max-w-[12rem] text-4xl font-black leading-none text-zinc-950">
                      5 aktive Tage
                    </h2>
                  </div>
                  <span className="rounded-full bg-black/80 px-2.5 py-1 text-xs font-bold text-white">EPIC</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-black/80 p-3 text-white">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Belohnung</p>
                    <p className="mt-1 flex items-center gap-1 text-lg font-black">
                      100 <Zap className="h-4 w-4 fill-current" />
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/80 p-3 text-white">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Endet</p>
                    <p className="mt-1 text-lg font-black">So 23:58</p>
                  </div>
                </div>
              </div>
            </button>

            <div className="space-y-3">
              {quests.map((quest) => {
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
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Quests;
