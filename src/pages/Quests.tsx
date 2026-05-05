import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Sparkles, Users } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import weeklyAvatarImg from "@/assets/quest-weekly-avatar.svg";
import classAvatarImg from "@/assets/quest-class-avatar.svg";
import friendAvatarImg from "@/assets/quest-friend-avatar.svg";
import tryitAvatarImg from "@/assets/quest-tryit-avatar.svg";
import { BOOST_POINT_RULES } from "@/lib/gamification";
import { AVATAR_BASE_ASSET, AVATAR_ITEMS, AvatarItemId, loadEquippedAvatarItem } from "@/lib/avatarItems";

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
    eyebrow: "WOCHENZIEL",
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
    description: "1.000 Kniebeugen gemeinsam schaffen und sehen, wer am meisten beigetragen hat.",
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
  const [userId, setUserId] = useState("");
  const [equippedAvatarItem, setEquippedAvatarItem] = useState<AvatarItemId>("none");

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/");
        return;
      }
      setUserId(session.user.id);
      setEquippedAvatarItem(loadEquippedAvatarItem(session.user.id));
      setLoading(false);
    };

    void loadProfile();
  }, [navigate]);

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

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <div className="mx-auto max-w-screen-xl px-4 pb-8 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-52 rounded-xl" />
            <Skeleton className="h-52 w-full rounded-[28px]" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
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
              <div className="min-w-0">
                <h1 className="text-3xl font-black tracking-tight text-foreground">Meine Quests</h1>
                <p className="mt-1 text-sm text-muted-foreground">Such dir eine Quest aus und sammle neue Blitze.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {quests.map((quest) => {
                const Icon = quest.icon;

                return (
                  <Card
                    key={quest.id}
                    className="overflow-hidden rounded-[24px] border border-black/5 bg-white p-0 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(quest.id === "class" ? "/class-quest" : `/challenge/${quest.id}`)}
                      className="flex w-full flex-col text-left"
                    >
                      <div className="flex h-32 items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef5e9_100%)] px-4 py-4">
                        <img
                          src={quest.image}
                          alt={quest.title}
                          className="max-h-full w-auto max-w-[82%] object-contain object-center mix-blend-multiply"
                        />
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                              {quest.eyebrow}
                            </span>
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-bold leading-tight text-foreground">{quest.title}</h3>
                          <p className="mt-1 text-sm leading-snug text-muted-foreground">{quest.description}</p>
                        </div>
                        <div className="mt-4 space-y-1">
                          <span className="block text-sm font-bold text-foreground">{quest.reward}</span>
                          <span className="block text-xs text-muted-foreground">{quest.meta}</span>
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
