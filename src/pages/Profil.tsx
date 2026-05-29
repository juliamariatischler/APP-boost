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
import { format } from "date-fns";
import { AVATAR_BASE_ASSET, AVATAR_ITEM_LIST, AVATAR_ITEMS, AvatarItemKey, AVATAR_ITEM_POINTS_THRESHOLD, computeMaxItemSlots, isAvatarItemId, loadEquippedAvatarItems, saveEquippedAvatarItems, parseDbEquippedItems, serializeEquippedItems } from "@/lib/avatarItems";
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
  const [totalPoints, setTotalPoints] = useState(0);
  const [equippedAvatarItems, setEquippedAvatarItems] = useState<AvatarItemKey[]>([]);
  const [ownedAvatarItems, setOwnedAvatarItems] = useState<AvatarItemKey[]>([]);
  const [showAllAvatarItems, setShowAllAvatarItems] = useState(false);
  const [pendingUnlockItem, setPendingUnlockItem] = useState<AvatarItemKey | null>(null);
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
          setEquippedAvatarItems(loadEquippedAvatarItems(codeSession.user_id));
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
        const uid = session.user.id;
        setUserId(uid);

        const [{ data: profileData }, healthStatus] = await Promise.all([
          supabase
            .from("profiles")
            .select("username, points, equipped_avatar_item, owned_avatar_items")
            .eq("id", uid)
            .single(),
          HealthService.isAvailable().catch(() => false),
        ]);

        await loadTodayHealthSyncInfo(uid);

        if (profileData) {
          setProfile({ username: profileData.username });
          setTotalPoints(profileData.points ?? 0);

          const dbOwned = ((profileData.owned_avatar_items ?? []) as string[])
            .filter(isAvatarItemId) as AvatarItemKey[];
          let finalOwned = dbOwned;
          let finalEquipped: AvatarItemKey[] = parseDbEquippedItems(profileData.equipped_avatar_item);

          if (dbOwned.length === 0 && !profileData.equipped_avatar_item) {
            // Migrate existing localStorage selection to DB on first load.
            const localItems = loadEquippedAvatarItems(uid);
            const maxSlots = computeMaxItemSlots(profileData.points ?? 0);
            if (localItems.length > 0 && maxSlots >= 1) {
              finalOwned = localItems.slice(0, maxSlots);
              finalEquipped = finalOwned;
              await supabase
                .from("profiles")
                .update({ owned_avatar_items: finalOwned, equipped_avatar_item: serializeEquippedItems(finalEquipped) })
                .eq("id", uid);
            }
          }

          setOwnedAvatarItems(finalOwned);
          setEquippedAvatarItems(finalEquipped);
          saveEquippedAvatarItems(uid, finalEquipped);
        } else {
          setProfile({ username: "Spieler" });
        }

        setHealthAvailable(healthStatus);
      } finally {
        setCheckingHealth(false);
        setLoading(false);
      }
    };

    void init();
  }, [navigate, codeSession, codeAuthLoading]);

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

    return steps;
  };

  const maxOwnedSlots = computeMaxItemSlots(totalPoints);
  const availableSlots = maxOwnedSlots - ownedAvatarItems.length;
  const progressToNextSlot = totalPoints % AVATAR_ITEM_POINTS_THRESHOLD;

  const visibleAvatarItems = showAllAvatarItems
    ? AVATAR_ITEM_LIST
    : AVATAR_ITEM_LIST.slice(0, INITIAL_VISIBLE_AVATAR_ITEMS);
  const hasHiddenAvatarItems = AVATAR_ITEM_LIST.length > INITIAL_VISIBLE_AVATAR_ITEMS;

  const handleToggleEquipItem = async (itemId: AvatarItemKey) => {
    if (!userId) return;

    const isOwned = ownedAvatarItems.includes(itemId);
    const isEquipped = equippedAvatarItems.includes(itemId);

    if (!isOwned) {
      if (availableSlots <= 0) {
        const blitzeNeeded = AVATAR_ITEM_POINTS_THRESHOLD - progressToNextSlot;
        toast.info(`Noch ${blitzeNeeded} Blitze bis zum nächsten Item-Slot.`);
        return;
      }
      // Show confirmation dialog before unlocking
      setPendingUnlockItem(itemId);
      return;
    }

    // Toggle on/off for already owned items
    const newEquipped = isEquipped
      ? equippedAvatarItems.filter((id) => id !== itemId)
      : [...equippedAvatarItems, itemId];

    setEquippedAvatarItems(newEquipped);
    saveEquippedAvatarItems(userId, newEquipped);
    await supabase
      .from("profiles")
      .update({ equipped_avatar_item: serializeEquippedItems(newEquipped) })
      .eq("id", userId);
    toast.success(newEquipped.includes(itemId) ? "Item angelegt." : "Item abgelegt.");
  };

  const handleConfirmUnlockItem = async () => {
    if (!userId || !pendingUnlockItem) return;
    const itemId = pendingUnlockItem;
    setPendingUnlockItem(null);

    const newOwned = [...ownedAvatarItems, itemId];
    const newEquipped = [...equippedAvatarItems, itemId];
    setOwnedAvatarItems(newOwned);
    setEquippedAvatarItems(newEquipped);
    saveEquippedAvatarItems(userId, newEquipped);
    await supabase
      .from("profiles")
      .update({ owned_avatar_items: newOwned, equipped_avatar_item: serializeEquippedItems(newEquipped) })
      .eq("id", userId);
    toast.success("Item freigeschaltet und angelegt!");
  };

  const handleRemoveAllItems = async () => {
    if (!userId) return;
    setEquippedAvatarItems([]);
    saveEquippedAvatarItems(userId, []);
    await supabase.from("profiles").update({ equipped_avatar_item: null }).eq("id", userId);
    toast.success("Alle Items entfernt.");
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
      if (userId) {
        const syncedSteps = await syncTodayHealthSteps(userId);
        if (syncedSteps === 0 && HealthService.isNativeAndroid()) {
          const description = await HealthService.getNoStepDataHelp();
          toast.info("Noch keine Schritte gefunden.", {
            description,
          });
        }
      }
      toast.success(`${HealthService.getHealthSourceLabel()} verbunden.`);
      return;
    }

    toast.error(`${HealthService.getHealthSourceLabel()} konnte nicht verbunden werden.`, {
      description: HealthService.getHealthPermissionHelp(),
    });
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
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white text-zinc-950 shadow-[0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]" style={{ transform: 'translateZ(0)' }}>
              <img src={AVATAR_BASE_ASSET} alt="Avatar" className="h-full w-full object-contain" />
              {equippedAvatarItems.map((itemId) => AVATAR_ITEMS[itemId] && (
                <img key={itemId} src={AVATAR_ITEMS[itemId].asset} alt={AVATAR_ITEMS[itemId].name} className="absolute inset-0 h-full w-full object-contain" />
              ))}
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
                Pro {AVATAR_ITEM_POINTS_THRESHOLD} Blitze schaltest du einen neuen Item-Slot frei.
              </p>
            </div>
            {maxOwnedSlots > 0 ? (
              <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${availableSlots > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {ownedAvatarItems.length} / {maxOwnedSlots}
              </div>
            ) : (
              <div className="rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {progressToNextSlot} / {AVATAR_ITEM_POINTS_THRESHOLD}
              </div>
            )}
          </div>

          <div className="rounded-[22px] border border-black/5 bg-[linear-gradient(135deg,#ffffff_0%,#edf8d7_100%)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.06)]">
            {/* Avatar preview + slot status */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_10px_22px_rgba(0,0,0,0.08)]" style={{ transform: 'translateZ(0)' }}>
                <img src={AVATAR_BASE_ASSET} alt="Avatar Vorschau" className="h-full w-full object-contain" />
                {equippedAvatarItems.map((itemId) => AVATAR_ITEMS[itemId] && (
                  <img key={itemId} src={AVATAR_ITEMS[itemId].asset} alt={AVATAR_ITEMS[itemId].name} className="absolute inset-0 h-full w-full object-contain" />
                ))}
              </div>
              {availableSlots > 0 ? (
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  {availableSlots === 1 ? "1 Slot frei" : `${availableSlots} Slots frei`}
                </div>
              ) : (
                <div className="rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {maxOwnedSlots === 0 ? "Noch gesperrt" : "Alle Slots belegt"}
                </div>
              )}
            </div>

            {/* Meine Items — owned items wardrobe */}
            {ownedAvatarItems.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Meine Items</p>
                  {equippedAvatarItems.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => void handleRemoveAllItems()}>
                      Alle ablegen
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ownedAvatarItems.map((itemId) => {
                    const item = AVATAR_ITEMS[itemId];
                    if (!item) return null;
                    const isEquipped = equippedAvatarItems.includes(itemId);
                    return (
                      <button
                        key={itemId}
                        type="button"
                        onClick={() => void handleToggleEquipItem(itemId)}
                        className={`flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-semibold transition ${
                          isEquipped
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-black/10 bg-white text-muted-foreground"
                        }`}
                      >
                        <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white" style={{ transform: 'translateZ(0)' }}>
                          <img src={AVATAR_BASE_ASSET} alt="" className="h-full w-full object-contain" />
                          <img src={item.asset} alt="" className="absolute inset-0 h-full w-full object-contain" />
                        </div>
                        {item.name}
                        {isEquipped && <Check className="h-3 w-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All items browser */}
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-foreground">
                {ownedAvatarItems.length === 0 ? "Wähle dein erstes Item" : "Alle Items"}
              </p>
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
                {equippedAvatarItems.length > 0 && ownedAvatarItems.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => void handleRemoveAllItems()}
                  >
                    Ohne Item
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {visibleAvatarItems.map((item) => {
                const isEquipped = equippedAvatarItems.includes(item.id);
                const isOwned = ownedAvatarItems.includes(item.id);
                const isLocked = !isOwned && availableSlots <= 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleToggleEquipItem(item.id)}
                    className={`rounded-[20px] border p-3 text-left shadow-[0_10px_22px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] transition ${
                      isEquipped
                        ? "border-primary bg-primary/10"
                        : isOwned
                          ? "border-primary/25 bg-primary/5"
                          : "border-black/5 bg-white"
                    } ${isLocked ? "opacity-55" : "opacity-100"}`}
                  >
                    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_8px_18px_rgba(0,0,0,0.08)]" style={{ transform: 'translateZ(0)' }}>
                      <img src={AVATAR_BASE_ASSET} alt={item.name} className="h-full w-full object-contain" />
                      <img src={item.asset} alt={item.name} className="absolute inset-0 h-full w-full object-contain" />
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
                          <Lock className="h-5 w-5 text-white drop-shadow" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.name}</p>
                        <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{item.description}</p>
                      </div>
                      {isEquipped && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {hasHiddenAvatarItems && !showAllAvatarItems && (
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
              {HealthService.getHealthSetupDescription()}
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
              {connectingHealth ? "Verbinde..." : HealthService.getHealthConnectionLabel()}
            </Button>

            {!checkingHealth && !HealthService.isHealthPlatformSupported() && (
              <p className="mt-2 text-xs text-center text-muted-foreground">
                Health-Sync ist aktuell nur auf iPhone oder Android verfügbar.
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

      {/* Unlock confirmation dialog */}
      <Dialog open={pendingUnlockItem !== null} onOpenChange={(open) => { if (!open) setPendingUnlockItem(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-[24px]">
          {pendingUnlockItem && AVATAR_ITEMS[pendingUnlockItem] && (() => {
            const item = AVATAR_ITEMS[pendingUnlockItem];
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Item einlösen?</DialogTitle>
                  <DialogDescription>
                    Du verwendest einen freien Item-Slot für <span className="font-semibold text-foreground">{item.name}</span>.
                  </DialogDescription>
                </DialogHeader>

                {/* Avatar preview with item */}
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.10)]" style={{ transform: 'translateZ(0)' }}>
                    <img src={AVATAR_BASE_ASSET} alt="Avatar" className="h-full w-full object-contain" />
                    {equippedAvatarItems.map((id) => AVATAR_ITEMS[id] && (
                      <img key={id} src={AVATAR_ITEMS[id].asset} alt="" className="absolute inset-0 h-full w-full object-contain" />
                    ))}
                    <img src={item.asset} alt={item.name} className="absolute inset-0 h-full w-full object-contain" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary">
                    <Zap className="h-4 w-4 fill-primary" />
                    1 Slot wird verwendet · {ownedAvatarItems.length + 1} / {maxOwnedSlots}
                  </div>
                </div>

                <DialogFooter className="flex-row gap-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-2xl" onClick={() => setPendingUnlockItem(null)}>
                    Abbrechen
                  </Button>
                  <Button type="button" className="flex-1 rounded-2xl" onClick={() => void handleConfirmUnlockItem()}>
                    Einlösen
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

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
