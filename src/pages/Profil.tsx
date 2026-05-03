import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Check, ChevronRight, HeartPulse, Lock, LogOut, School, Settings2, ShieldCheck, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PointSystemCard } from "@/components/boost/PointSystemCard";
import { HealthService } from "@/services/healthService";
import { supabase } from "@/integrations/supabase/client";
import { getDemoAwarePoints } from "@/lib/demo";
import { toast } from "sonner";
import { BOOST_POINT_RULES, countCompletedDailyExercises, isDailyGoalComplete } from "@/lib/gamification";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { AVATAR_BASE_ASSET, AVATAR_ITEM_LIST, AVATAR_ITEMS, AvatarItemId, loadEquippedAvatarItem, saveEquippedAvatarItem, WEEKLY_AVATAR_ITEM_THRESHOLD } from "@/lib/avatarItems";

interface ProfileData {
  username: string;
  school: string;
  class: string;
  points: number;
}

const Profil = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingHealth, setCheckingHealth] = useState(true);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [connectingHealth, setConnectingHealth] = useState(false);
  const [userId, setUserId] = useState("");
  const [weeklyBlitze, setWeeklyBlitze] = useState(0);
  const [equippedAvatarItem, setEquippedAvatarItem] = useState<AvatarItemId>("none");

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          navigate("/");
          return;
        }
        setUserId(session.user.id);
        setEquippedAvatarItem(loadEquippedAvatarItem(session.user.id));

        const [{ data: profileData }, healthStatus] = await Promise.all([
          supabase
            .from("profiles")
            .select("username, school, class, points")
            .eq("id", session.user.id)
            .single(),
          HealthService.isAvailable().catch(() => false),
        ]);

        await loadWeeklyBlitze(session.user.id);

        if (profileData) {
          setProfile({
            ...profileData,
            points: getDemoAwarePoints(profileData.points, session.user.email),
          });
        } else {
          setProfile({
            username: "Spieler",
            school: "",
            class: "",
            points: 0,
          });
        }

        setHealthAvailable(healthStatus);
      } finally {
        setCheckingHealth(false);
        setLoading(false);
      }
    };

    void init();
  }, [navigate]);

  const loadWeeklyBlitze = async (uid: string) => {
    const today = new Date();
    const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });

    const { data } = await supabase
      .from("daily_results")
      .select("date, jumping_jacks, push_ups, squats, planks, sit_ups, steps")
      .eq("user_id", uid)
      .gte("date", format(weekStart, "yyyy-MM-dd"))
      .lte("date", format(weekEnd, "yyyy-MM-dd"));

    const total = (data || []).reduce((sum, day) => {
      const completedExercises = countCompletedDailyExercises({
        jumping_jacks: day.jumping_jacks || 0,
        push_ups: day.push_ups || 0,
        squats: day.squats || 0,
        planks: day.planks || 0,
        sit_ups: day.sit_ups || 0,
      });

      let dailyBlitze = completedExercises * BOOST_POINT_RULES.exerciseCompleted;
      if (
        isDailyGoalComplete(day.steps || 0, {
          jumping_jacks: day.jumping_jacks || 0,
          push_ups: day.push_ups || 0,
          squats: day.squats || 0,
          planks: day.planks || 0,
          sit_ups: day.sit_ups || 0,
        })
      ) {
        dailyBlitze += BOOST_POINT_RULES.dailyGoalCompleted;
      }

      return sum + dailyBlitze;
    }, 0);

    setWeeklyBlitze(total);
  };

  const weeklyItemUnlocked = weeklyBlitze >= WEEKLY_AVATAR_ITEM_THRESHOLD;

  const handleEquipAvatarItem = (itemId: AvatarItemId) => {
    if (!userId) return;
    if (itemId !== "none" && !weeklyItemUnlocked) {
      toast.info(`Sammle erst ${WEEKLY_AVATAR_ITEM_THRESHOLD} Blitze in dieser Woche.`);
      return;
    }

    setEquippedAvatarItem(itemId);
    saveEquippedAvatarItem(userId, itemId);
    toast.success(itemId === "none" ? "Avatar-Item entfernt." : "Avatar-Item gespeichert.");
  };

  const handleConnectHealthData = async () => {
    if (!HealthService.isHealthPlatformSupported()) {
      toast.info("Health-Sync ist nur auf iPhone oder Android verfügbar.");
      return;
    }

    setConnectingHealth(true);
    const connected = await HealthService.connectHealthData();
    setConnectingHealth(false);

    if (connected) {
      setHealthAvailable(true);
      toast.success(`${HealthService.getHealthSourceLabel()} verbunden.`);
      return;
    }

    toast.error(`${HealthService.getHealthSourceLabel()} konnte nicht verbunden werden.`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background pb-nav-safe">
        <div className="mx-auto max-w-screen-xl space-y-4 px-4">
          <div className="pt-[calc(env(safe-area-inset-top)+1rem)]" />
          <Skeleton className="h-32 w-full rounded-[28px]" />
          <Skeleton className="h-32 w-full rounded-[28px]" />
          <Skeleton className="h-40 w-full rounded-[28px]" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <div className="mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <Card className="mb-4 overflow-hidden rounded-[30px] border border-black/5 bg-[linear-gradient(135deg,#ffffff_0%,#edf8d7_100%)] p-5 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">Profil</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground">{profile.username}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <School className="h-4 w-4" />
                {profile.school} {profile.class ? `• ${profile.class}` : ""}
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Boost Mitglied
              </div>
            </div>
            <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white text-zinc-950 shadow-[0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]">
              <img src={AVATAR_BASE_ASSET} alt="Avatar" className="h-full w-full object-contain" />
              {equippedAvatarItem !== "none" && AVATAR_ITEMS[equippedAvatarItem] && (
                <img
                  src={AVATAR_ITEMS[equippedAvatarItem].asset}
                  alt={AVATAR_ITEMS[equippedAvatarItem].name}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white text-foreground shadow-[0_10px_25px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Blitze</p>
              <p className="mt-2 flex items-center gap-1 text-xl font-black text-foreground">
                {profile.points}
                <Zap className="h-4.5 w-4.5 fill-primary text-primary" />
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Klasse</p>
              <p className="mt-2 truncate text-xl font-black text-foreground">{profile.class || "-"}</p>
            </div>
          </div>
        </Card>

        <div className="mb-4">
          <PointSystemCard />
        </div>

        <Card className="mb-4 rounded-[26px] border border-black/5 bg-white p-4 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-foreground">Avatar-Item</h2>
              <p className="text-sm text-muted-foreground">
                Ab {WEEKLY_AVATAR_ITEM_THRESHOLD} Wochen-Blitzen schaltest du ein Item frei.
              </p>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${weeklyItemUnlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {weeklyBlitze} / {WEEKLY_AVATAR_ITEM_THRESHOLD}
            </div>
          </div>

          <div className="rounded-[22px] border border-black/5 bg-[linear-gradient(135deg,#ffffff_0%,#edf8d7_100%)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.06)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_10px_22px_rgba(0,0,0,0.08)]">
                <img src={AVATAR_BASE_ASSET} alt="Avatar Vorschau" className="h-full w-full object-contain" />
                {equippedAvatarItem !== "none" && AVATAR_ITEMS[equippedAvatarItem] && (
                  <img
                    src={AVATAR_ITEMS[equippedAvatarItem].asset}
                    alt={AVATAR_ITEMS[equippedAvatarItem].name}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                )}
              </div>
              {weeklyItemUnlocked ? (
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  Freigeschaltet
                </div>
              ) : (
                <div className="rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Noch gesperrt
                </div>
              )}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-foreground">Wähle dein Item</p>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => handleEquipAvatarItem("none")}
              >
                Ohne Item
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {AVATAR_ITEM_LIST.map((item) => {
                const isActive = equippedAvatarItem === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleEquipAvatarItem(item.id)}
                    disabled={!weeklyItemUnlocked}
                    className={`rounded-[20px] border p-3 text-left shadow-[0_10px_22px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] transition ${
                      isActive ? "border-primary bg-primary/10" : "border-black/5 bg-white"
                    } ${weeklyItemUnlocked ? "opacity-100" : "opacity-55"}`}
                  >
                    <div className="relative mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
                      <img src={AVATAR_BASE_ASSET} alt={item.name} className="h-full w-full object-contain" />
                      <img src={item.asset} alt={item.name} className="absolute inset-0 h-full w-full object-contain" />
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.name}</p>
                        <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{item.description}</p>
                      </div>
                      {isActive ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : !weeklyItemUnlocked ? (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="rounded-[26px] border-0 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-foreground">Health-Sync</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Verbinde {HealthService.getHealthSourceLabel()}, damit echte Schritte automatisch in BOOST landen.
            </p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
              <span className="text-sm text-foreground">Status</span>
              <span className="text-sm font-medium text-muted-foreground">
                {checkingHealth ? "Wird geprüft..." : healthAvailable ? "Verbunden" : "Nicht verbunden"}
              </span>
            </div>
            <Button className="mt-4 w-full rounded-2xl" onClick={handleConnectHealthData} disabled={connectingHealth}>
              {connectingHealth ? "Verbinde..." : "Health-Daten verbinden"}
            </Button>
          </Card>

          <Card className="rounded-[26px] border-0 bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <button
              type="button"
              onClick={() => navigate("/rewards")}
              className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition hover:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Belohnungen</p>
                  <p className="text-sm text-muted-foreground">Persönliche und Klassen-Rewards</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => navigate("/quests")}
              className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition hover:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Meine Quests</p>
                  <p className="text-sm text-muted-foreground">Direkt zu Weekly, Daily und Try It</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => navigate("/boost")}
              className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition hover:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">BOOST-System</p>
                  <p className="text-sm text-muted-foreground">Blitze, Streaks und Klassenlogik</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition hover:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Weitere Einstellungen</p>
                  <p className="text-sm text-muted-foreground">Gerätefunktionen und App-Optionen</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </Card>

          <Button variant="destructive" className="mb-4 w-full rounded-2xl" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profil;
