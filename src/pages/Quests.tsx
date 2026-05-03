import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Sparkles, Users, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import weeklyAvatarImg from "@/assets/quest-weekly-avatar.svg";
import classAvatarImg from "@/assets/quest-class-avatar.svg";
import friendAvatarImg from "@/assets/quest-friend-avatar.svg";
import tryitAvatarImg from "@/assets/quest-tryit-avatar.svg";
import { BOOST_POINT_RULES } from "@/lib/gamification";

type QuestCard = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  reward: string;
  meta: string;
  image: string;
  icon: typeof Sparkles;
};

const quests: QuestCard[] = [
  {
    id: "weekly",
    title: "Wochen-Quest",
    eyebrow: "EPIC",
    description: "5 aktive Tage schaffen und dir die Wochenbelohnung sichern.",
    reward: `+${BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡`,
    meta: "Endet Sonntag 23:59",
    image: weeklyAvatarImg,
    icon: Sparkles,
  },
  {
    id: "class",
    title: "Klassen-Quest",
    eyebrow: "GEMEINSAM",
    description: "1.000 Liegestütze gemeinsam schaffen und eure Klasse im Ranking nach vorne bringen.",
    reward: "Für deine Klasse",
    meta: "1 Monat aktiv",
    image: classAvatarImg,
    icon: Sparkles,
  },
  {
    id: "friend",
    title: "Friendquest",
    eyebrow: "TEAM",
    description: "Fordere Freund:innen heraus und sammelt gemeinsam Bewegungspunkte.",
    reward: "Mehr Spaß zusammen",
    meta: "Gemeinsam spielen",
    image: friendAvatarImg,
    icon: Users,
  },
  {
    id: "tryit",
    title: "Try It",
    eyebrow: "NEU",
    description: "Teste eine neue Sportart, ein Training oder einen Verein in deiner Nähe.",
    reward: `+${BOOST_POINT_RULES.tryItCompleted} ⚡`,
    meta: "In deiner Nähe",
    image: tryitAvatarImg,
    icon: MapPin,
  },
];

const Quests = () => {
  const navigate = useNavigate();
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
      setLoading(false);
    };

    void loadProfile();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <div className="mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
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
              <h1 className="text-3xl font-black tracking-tight text-foreground">Deine Quests</h1>
              <p className="mt-1 text-sm text-muted-foreground">Wähle eine Challenge und sammle heute neue Blitze.</p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/challenge/weekly")}
              className="mb-6 block w-full text-left"
            >
              <div className="overflow-hidden rounded-[28px] bg-gradient-primary p-5 shadow-[0_20px_60px_rgba(31,224,102,0.24)]">
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
                      {BOOST_POINT_RULES.weeklyChallengeCompleted} <Zap className="h-4 w-4 fill-current" />
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
                    className="overflow-hidden rounded-[24px] border border-black/5 bg-white p-0 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(quest.id === "class" ? "/klasse" : `/challenge/${quest.id}`)}
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
