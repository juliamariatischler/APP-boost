import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { Award, Check, ChevronRight, HeartPulse, Lock, LogOut, MessageSquare, Scale, Send, Settings2, ShieldCheck, Star, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { HealthService } from "@/services/healthService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BOOST_POINT_RULES, countCompletedDailyExercises, isDailyGoalComplete } from "@/lib/gamification";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { AVATAR_BASE_ASSET, AVATAR_ITEM_LIST, AVATAR_ITEMS, AvatarItemId, loadEquippedAvatarItem, saveEquippedAvatarItem, WEEKLY_AVATAR_ITEM_THRESHOLD } from "@/lib/avatarItems";
import { ONBOARDING_OPEN_EVENT } from "@/lib/onboarding";
import { formatDisplayName } from "@/lib/formatName";
import { logoutEverywhereOnDevice } from "@/lib/logout";

interface ProfileData {
  username: string;
}

type HealthSyncInfo = {
  steps: number;
  syncedAt: string | null;
  active: boolean;
};

const Profil = () => {
  const INITIAL_VISIBLE_AVATAR_ITEMS = 3;
  const navigate = useNavigate();
  const { session: codeSession, loading: codeAuthLoading } = useCodeAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingHealth, setCheckingHealth] = useState(true);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [healthSyncInfo, setHealthSyncInfo] = useState<HealthSyncInfo | null>(null);
  const [connectingHealth, setConnectingHealth] = useState(false);
  const [userId, setUserId] = useState("");
  const [weeklyBlitze, setWeeklyBlitze] = useState(0);
  const [equippedAvatarItem, setEquippedAvatarItem] = useState<AvatarItemId>("none");
  const [showAllAvatarItems, setShowAllAvatarItems] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const settingsSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const init = async () => {
      if (codeAuthLoading) return;
      try {
        if (codeSession?.user_type === "student") {
          setUserId(codeSession.user_id);
          setEquippedAvatarItem(loadEquippedAvatarItem(codeSession.user_id));
          setProfile({ username: codeSession.display_name || "Spieler" });
          setHealthAvailable(false);
          setCheckingHealth(false);
          setLoading(false);
          return;
        }
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
            .select("username")
            .eq("id", session.user.id)
            .single(),
          HealthService.isAvailable().catch(() => false),
        ]);

        await Promise.all([
          loadWeeklyBlitze(session.user.id),
          loadTodayHealthSyncInfo(session.user.id),
        ]);

        if (profileData) {
          setProfile(profileData);
        } else {
          setProfile({
            username: "Spieler",
          });
        }

        setHealthAvailable(healthStatus);
      } finally {
        setCheckingHealth(false);
        setLoading(false);
      }
    };

    void init();
  }, [navigate, codeSession, codeAuthLoading]);

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

  const loadTodayHealthSyncInfo = async (uid: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("daily_results")
      .select("steps, steps_tracking_active, updated_at")
      .eq("user_id", uid)
      .eq("date", today)
      .maybeSingle();

    if (!data) {
      setHealthSyncInfo(null);
      return;
    }

    setHealthSyncInfo({
      steps: Number(data.steps || 0),
      syncedAt: data.updated_at ? format(new Date(data.updated_at), "HH:mm") : null,
      active: !!data.steps_tracking_active,
    });
  };

  const syncTodayHealthSteps = async (uid: string) => {
    const steps = await HealthService.getTodaySteps();
    const today = format(new Date(), "yyyy-MM-dd");
    const now = new Date().toISOString();

    await supabase
      .from("daily_results")
      .upsert(
        {
          user_id: uid,
          date: today,
          steps,
          steps_tracking_active: true,
          updated_at: now,
        },
        { onConflict: "user_id,date" }
      );

    setHealthSyncInfo({
      steps,
      syncedAt: format(new Date(now), "HH:mm"),
      active: true,
    });
  };

  const weeklyItemUnlocked = weeklyBlitze >= WEEKLY_AVATAR_ITEM_THRESHOLD;
  const selectedItemIndex = AVATAR_ITEM_LIST.findIndex((item) => item.id === equippedAvatarItem);
  const visibleAvatarItems = showAllAvatarItems
    ? AVATAR_ITEM_LIST
    : AVATAR_ITEM_LIST.filter((item, index) => index < INITIAL_VISIBLE_AVATAR_ITEMS || index === selectedItemIndex);
  const hasHiddenAvatarItems = AVATAR_ITEM_LIST.length > visibleAvatarItems.length;

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
      toast.info("Health-Sync ist nur auf dem iPhone verfügbar.");
      return;
    }

    setConnectingHealth(true);
    const connected = await HealthService.connectHealthData();
    setConnectingHealth(false);

    if (connected) {
      setHealthAvailable(true);
      if (userId) {
        await syncTodayHealthSteps(userId);
      }
      toast.success(`${HealthService.getHealthSourceLabel()} verbunden.`);
      return;
    }

    toast.error(`${HealthService.getHealthSourceLabel()} konnte nicht verbunden werden.`);
  };

  const handleLogout = async () => {
    await logoutEverywhereOnDevice();
    navigate("/auth", { replace: true });
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user.id;

      const { error } = await supabase.rpc("delete_my_account");

      if (error) {
        throw error;
      }

      if (currentUserId && typeof window !== "undefined") {
        window.localStorage.removeItem(`boost:avatar-item:${currentUserId}`);
        window.localStorage.removeItem(`weekly_video_rewards_${currentUserId}`);
      }

      await logoutEverywhereOnDevice();
      toast.success("Dein Konto wurde gelöscht.");
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast.error("Konto konnte nicht gelöscht werden: " + (error?.message ?? "Unbekannter Fehler"));
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleOpenOnboarding = () => {
    window.dispatchEvent(new Event(ONBOARDING_OPEN_EVENT));
  };

  const handleOpenSettingsSection = () => {
    settingsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmitFeedback = async () => {
    const message = feedbackMessage.trim();

    if (message.length < 3) {
      toast.error("Bitte schreibe kurz, worum es geht.");
      return;
    }

    setSendingFeedback(true);
    try {
      const { data, error } = await (supabase.rpc as any)("submit_feedback", {
        p_message: message,
        p_rating: feedbackRating,
        p_page: "profile",
        p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        p_device_id: null,
        p_session_token: null,
      });
      if (error) throw error;

      const result = data as Record<string, unknown> | null;
      if (result?.error) throw new Error(String(result.error));

      setFeedbackMessage("");
      setFeedbackRating(5);
      setFeedbackOpen(false);
      toast.success("Feedback gespeichert. Danke!");
    } catch (error) {
      console.error("Feedback submission failed:", error);
      toast.error("Feedback konnte nicht gespeichert werden.");
    } finally {
      setSendingFeedback(false);
    }
  };

  const feedbackRatingLabel = feedbackRating === 1
    ? "Gefällt wenig"
    : feedbackRating === 5
      ? "Mega App"
      : `${feedbackRating} von 5`;

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background pb-nav-safe">
        <div className="mx-auto max-w-screen-xl space-y-4 px-4">
          <div className="pt-4" />
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
      <div className="mx-auto max-w-screen-xl overflow-x-hidden px-4 pt-3">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white text-zinc-950 shadow-[0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]">
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
              <p className="text-[18px] font-semibold text-muted-foreground">Profil</p>
              <h1 className="mt-1 max-w-full truncate text-[2.1rem] font-black leading-none tracking-tight text-primary">
                {formatDisplayName(profile.username)}
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenSettingsSection}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white text-foreground shadow-[0_10px_25px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]"
            aria-label="Einstellungen öffnen"
          >
            <Settings2 className="h-4 w-4" />
          </button>
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
              <div className="flex items-center gap-2">
                {AVATAR_ITEM_LIST.length > INITIAL_VISIBLE_AVATAR_ITEMS && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => setShowAllAvatarItems((prev) => !prev)}
                  >
                    {showAllAvatarItems ? "Weniger" : "Alle"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => handleEquipAvatarItem("none")}
                >
                  Ohne Item
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {visibleAvatarItems.map((item) => {
                const isActive = equippedAvatarItem === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleEquipAvatarItem(item.id)}
                    disabled={!weeklyItemUnlocked}
                    className={`rounded-[20px] border p-3 text-left shadow-[0_10px_22px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] transition ${isActive ? "border-primary bg-primary/10" : "border-black/5 bg-white"
                      } ${weeklyItemUnlocked ? "opacity-100" : "opacity-55"}`}
                  >
                    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
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

            {hasHiddenAvatarItems && (
              <p className="mt-3 text-center text-xs font-medium text-muted-foreground">
                Tippe auf "Alle", um weitere Items zu sehen.
              </p>
            )}
          </div>
        </Card>

        <div ref={settingsSectionRef} className="space-y-3">
          <Card className="rounded-[26px] border-0 bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <button
              type="button"
              onClick={handleOpenOnboarding}
              className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition hover:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">App-Erklärung</p>
                  <p className="text-sm text-muted-foreground">Onboarding nochmal ansehen</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

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
              onClick={() => setFeedbackOpen(true)}
              className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition hover:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Feedback</p>
                  <p className="text-sm text-muted-foreground">Idee, Problem oder Wunsch senden</p>
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
              onClick={() => navigate("/legal")}
              className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition hover:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <Scale className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Rechtliches</p>
                  <p className="text-sm text-muted-foreground">Impressum, Datenschutz und Nutzungsbedingungen</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </Card>

          <Card className="rounded-[26px] border-0 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-foreground">Health-Daten</h3>
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
            <div className="mt-3 rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>Plattform</span>
                <span className="font-medium text-foreground">{HealthService.getPlatformLabel()}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span>Quelle</span>
                <span className="font-medium text-foreground">{HealthService.getHealthSourceLabel()}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span>Native Health</span>
                <span className="font-medium text-foreground">
                  {HealthService.isHealthPlatformSupported() ? "unterstuetzt" : "nicht unterstuetzt"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span>Letzter Sync</span>
                <span className="font-medium text-foreground">
                  {healthSyncInfo?.active && healthSyncInfo.syncedAt
                    ? `${healthSyncInfo.steps.toLocaleString("de-DE")} Schritte, ${healthSyncInfo.syncedAt}`
                    : "noch nicht synchronisiert"}
                </span>
              </div>
            </div>
            <Button className="mt-4 w-full rounded-2xl" onClick={handleConnectHealthData} disabled={connectingHealth}>
              {connectingHealth ? "Verbinde..." : "Health-Daten verbinden"}
            </Button>

            {!checkingHealth && !HealthService.isHealthPlatformSupported() && (
              <p className="mt-2 text-xs text-center text-muted-foreground">
                Health-Sync ist aktuell nur auf dem iPhone verfügbar.
              </p>
            )}
          </Card>

          <Card className="rounded-[26px] border-0 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <Button variant="destructive" className="w-full rounded-2xl" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </Button>

            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <h2 className="text-base font-semibold text-red-700">Konto löschen</h2>
              <p className="mt-1 text-sm text-red-700/80">
                Dein Konto und deine zugehörigen Daten werden dauerhaft gelöscht.
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="mt-4 w-full rounded-2xl border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800">
                    Konto dauerhaft löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Konto wirklich löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Diese Aktion kann nicht rückgängig gemacht werden. Dein Konto, dein Profil und deine Fortschritte werden dauerhaft entfernt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault();
                        if (!deletingAccount) {
                          void handleDeleteAccount();
                        }
                      }}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      {deletingAccount ? "Lösche..." : "Ja, Konto löschen"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Feedback senden</DialogTitle>
            <DialogDescription>
              Schreib kurz, was verbessert werden soll oder wo etwas nicht passt.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-muted/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-foreground">Wie gefällt dir BOOST?</span>
              <span className="text-xs font-semibold text-muted-foreground">{feedbackRatingLabel}</span>
            </div>
            <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Feedback Bewertung">
              {[1, 2, 3, 4, 5].map((rating) => {
                const isActive = rating <= feedbackRating;

                return (
                  <button
                    key={rating}
                    type="button"
                    role="radio"
                    aria-checked={feedbackRating === rating}
                    aria-label={`${rating} von 5 Sternen`}
                    onClick={() => setFeedbackRating(rating)}
                    className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white"
                    disabled={sendingFeedback}
                  >
                    <Star className={`h-7 w-7 ${isActive ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/35"}`} />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between px-1 text-[11px] font-medium text-muted-foreground">
              <span>1 gefällt wenig</span>
              <span>5 Mega App</span>
            </div>
          </div>
          <Textarea
            value={feedbackMessage}
            onChange={(event) => setFeedbackMessage(event.target.value)}
            placeholder="Dein Feedback..."
            className="min-h-32 resize-none rounded-2xl"
            maxLength={1000}
          />
          <div className="text-right text-xs text-muted-foreground">
            {feedbackMessage.trim().length}/1000
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setFeedbackOpen(false)}
              disabled={sendingFeedback}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => void handleSubmitFeedback()}
              disabled={sendingFeedback || feedbackMessage.trim().length < 3}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendingFeedback ? "Sendet..." : "Senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Profil;
