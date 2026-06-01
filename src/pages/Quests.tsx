import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Sparkles, Users, Zap } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import weeklyAvatarImg from "@/assets/quest-weekly-bike-avatar.png";
import classAvatarImg from "@/assets/quest-class-avatar.png";
import friendAvatarImg from "@/assets/quest-friend-emoji.svg";
import tryitAvatarImg from "@/assets/quest-tryit-football-avatar.png";
import { BOOST_POINT_RULES } from "@/lib/gamification";
import { AVATAR_BASE_ASSET, AVATAR_ITEMS, AvatarItemKey, loadEquippedAvatarItems } from "@/lib/avatarItems";
import { getActiveRoute } from "@/lib/nfcRouteService";

type QuestCard = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  reward: string;
  meta: string;
  image: string;
  icon: typeof Sparkles;
  bgClass?: string;
  imgClass?: string;
  shadowClass?: string;
  groundClass?: string;
  containerClass?: string;
};

const Blitz3D = () => (
  <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(145deg,#baff76_0%,#61dc70_46%,#22a64a_100%)] text-white shadow-[0_9px_14px_rgba(31,224,102,0.34),0_3px_0_rgba(20,120,52,0.28),inset_0_2px_2px_rgba(255,255,255,0.68),inset_0_-3px_5px_rgba(0,0,0,0.18)]">
    <span className="absolute left-1.5 top-1 h-2 w-3 rounded-full bg-white/45 blur-[1px]" />
    <Zap className="relative h-[18px] w-[18px] fill-current drop-shadow-[0_2px_2px_rgba(0,0,0,0.24)]" />
  </span>
);

const RewardDisplay = ({ reward }: { reward: string }) => {
  if (!reward.includes("⚡")) {
    return <span className="block text-xs font-bold text-foreground">{reward}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-2 pr-1 text-xs font-black text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
      {reward.replace("⚡", "").trim()}
      <Blitz3D />
    </span>
  );
};

const QuestAvatar = ({ quest }: { quest: QuestCard }) => (
  <div className={`relative flex items-center justify-center overflow-hidden px-2 py-2 ${quest.containerClass ?? "h-36"} ${quest.bgClass ?? "bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.58)_34%,transparent_66%),linear-gradient(180deg,#f8fafc_0%,#eef5e9_100%)]"}`}>
    <div className="absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(to_top,rgba(34,197,94,0.42)_0%,rgba(74,222,128,0.18)_55%,transparent_100%)]" />
    <div className="absolute bottom-2 h-3 w-[72%] rounded-full shadow-[0_0_18px_6px_rgba(0,0,0,0.14)]" />
    {quest.groundClass && <div className={quest.groundClass} />}
    <img
      src={quest.image}
      alt={quest.title}
      className={
        quest.imgClass ??
        "relative z-10 max-h-[118%] w-auto max-w-[108%] object-contain object-center drop-shadow-[0_22px_20px_rgba(15,23,42,0.32)] saturate-[1.08] contrast-[1.04]"
      }
    />
    <div className={`pointer-events-none absolute inset-x-6 top-4 h-10 rounded-full bg-white/35 ${quest.shadowClass ?? ""}`} />
  </div>
);

const STATIC_QUESTS: QuestCard[] = [
  {
    id: "weekly",
    title: "Wochen-Quest",
    eyebrow: "WOCHENZIEL",
    description: `Bewältige die 2 Wochenchallenge und hole dir die ${BOOST_POINT_RULES.weeklyChallengeCompleted} Blitze.`,
    reward: `+${BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡`,
    meta: "Aktuelle Mission",
    image: weeklyAvatarImg,
    icon: Sparkles,
    imgClass: "relative z-10 max-h-[116%] w-auto max-w-[112%] object-contain object-bottom drop-shadow-[0_26px_22px_rgba(15,23,42,0.36)] saturate-[1.1] contrast-[1.05]",
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
    imgClass: "relative z-10 max-h-[112%] w-auto max-w-[110%] object-contain object-center drop-shadow-[0_24px_22px_rgba(15,23,42,0.34)] saturate-[1.08] contrast-[1.04]",
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
    imgClass: "relative z-10 h-full w-auto mx-auto saturate-[1.1] contrast-[1.05]",
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
    imgClass: "relative z-10 max-h-[126%] w-auto max-w-[120%] object-contain object-bottom drop-shadow-[0_26px_22px_rgba(15,23,42,0.36)] saturate-[1.1] contrast-[1.05]",
  },
];

const Quests = () => {
  const navigate = useNavigate();
  const { session: codeSession, loading: codeAuthLoading } = useCodeAuth();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [equippedAvatarItems, setEquippedAvatarItems] = useState<AvatarItemKey[]>([]);
  const [weeklyMeta, setWeeklyMeta] = useState("Aktuelle Mission");

  useEffect(() => {
    void getActiveRoute().then((route) => {
      if (route?.ends_at) {
        setWeeklyMeta(`Endet ${format(new Date(route.ends_at), "d. MMM", { locale: de })}`);
      }
    });
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (codeAuthLoading) return;
      if (codeSession?.user_type === "student") {
        setUserId(codeSession.user_id);
        setEquippedAvatarItems(loadEquippedAvatarItems(codeSession.user_id));
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }
      setUserId(session.user.id);
      setEquippedAvatarItems(loadEquippedAvatarItems(session.user.id));
      setLoading(false);
    };

    void loadProfile();
  }, [navigate, codeSession, codeAuthLoading]);

  useEffect(() => {
    if (!userId) return;

    const handleStorage = () => {
      setEquippedAvatarItems(loadEquippedAvatarItems(userId));
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
      <div className="mx-auto max-w-screen-xl px-4 pb-8 pt-3">
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
                {equippedAvatarItems.map((itemId) => AVATAR_ITEMS[itemId] && (
                  <img key={itemId} src={AVATAR_ITEMS[itemId].asset} alt={AVATAR_ITEMS[itemId].name} className="absolute inset-0 h-full w-full object-contain" />
                ))}
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-black tracking-tight text-foreground">Meine Quests</h1>
                <p className="mt-1 text-sm text-muted-foreground">Such dir eine Quest aus und sammle neue Blitze.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {STATIC_QUESTS.map((quest) => {
                const Icon = quest.icon;
                const meta = quest.id === "weekly" ? weeklyMeta : quest.meta;

                return (
                  <Card
                    key={quest.id}
                    className="overflow-hidden rounded-[24px] border border-black/5 bg-white p-0 shadow-[0_18px_36px_rgba(0,0,0,0.08),0_8px_28px_rgba(34,197,94,0.18),inset_0_1px_0_rgba(255,255,255,0.72)]"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(quest.id === "class" ? "/class-quest" : `/challenge/${quest.id}`)}
                      className="flex w-full flex-col text-left"
                    >
                      <QuestAvatar quest={quest} />
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                              {quest.eyebrow}
                            </span>
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <h3 className="text-base font-black leading-tight text-foreground">{quest.title}</h3>
                          <p className="mt-1 text-xs leading-snug text-muted-foreground">{quest.description}</p>
                        </div>
                        <div className="mt-4 space-y-1">
                          <RewardDisplay reward={quest.reward} />
                          <span className="block text-xs text-muted-foreground">{meta}</span>
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
