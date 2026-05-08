import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, MapPin, Mountain, Play, Route, Trophy, Video, Zap } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TopHeader } from "@/components/TopHeader";
import { supabase } from "@/integrations/supabase/client";
import { BOOST_POINT_RULES } from "@/lib/gamification";
import { getCurrentWeeklyVideo, WEEKLY_VIDEO_REWARD_STORAGE_KEY, type WeeklyVideo } from "@/lib/weeklyVideo";

const REWARD_POINTS = BOOST_POINT_RULES.weeklyChallengeCompleted;

type WeeklyRewardMap = Record<string, boolean>;

const WeeklyAthleteChallenge = () => {
  const navigate = useNavigate();
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isWeeklyVideoCompleted, setIsWeeklyVideoCompleted] = useState(false);
  const [rewardingVideo, setRewardingVideo] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const currentWeeklyVideo = useMemo<WeeklyVideo>(() => getCurrentWeeklyVideo(), []);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    };

    void loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    try {
      const stored = localStorage.getItem(`${WEEKLY_VIDEO_REWARD_STORAGE_KEY}_${userId}`);
      const parsed: WeeklyRewardMap = stored ? JSON.parse(stored) : {};
      setIsWeeklyVideoCompleted(Boolean(parsed[currentWeeklyVideo.weekKey]));
    } catch {
      setIsWeeklyVideoCompleted(false);
    }
  }, [currentWeeklyVideo.weekKey, userId]);

  const persistWeeklyVideoReward = (weekKey: string) => {
    setIsWeeklyVideoCompleted(true);

    if (!userId) return;

    try {
      const stored = localStorage.getItem(`${WEEKLY_VIDEO_REWARD_STORAGE_KEY}_${userId}`);
      const parsed: WeeklyRewardMap = stored ? JSON.parse(stored) : {};
      const nextValue = { ...parsed, [weekKey]: true };
      localStorage.setItem(`${WEEKLY_VIDEO_REWARD_STORAGE_KEY}_${userId}`, JSON.stringify(nextValue));
    } catch {
      localStorage.setItem(
        `${WEEKLY_VIDEO_REWARD_STORAGE_KEY}_${userId}`,
        JSON.stringify({ [weekKey]: true }),
      );
    }
  };

  const handleVideoCompleted = async () => {
    if (!userId) {
      toast.error("Bitte melde dich an, damit wir dir die Blitze gutschreiben koennen.");
      return;
    }

    if (isWeeklyVideoCompleted) {
      toast.success("Dieses Wochenvideo hast du diese Woche schon geschafft.");
      return;
    }

    setRewardingVideo(true);

    try {
      const { error } = await supabase.rpc("increment_points", { points_to_add: REWARD_POINTS });

      if (error) {
        throw error;
      }

      persistWeeklyVideoReward(currentWeeklyVideo.weekKey);
      window.dispatchEvent(new CustomEvent("points-updated", { detail: { delta: REWARD_POINTS } }));
      toast.success(`Wochenvideo geschafft! +${REWARD_POINTS} Blitze`);
    } catch (error) {
      console.error("Weekly video reward failed", error);
      toast.error("Video beendet, aber die Blitze konnten nicht gutgeschrieben werden.");
    } finally {
      setRewardingVideo(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader backTo="/quests" />

      <div className="mx-auto max-w-screen-xl px-4 pb-8">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-lg">
          <div className="grid gap-6 p-6 md:grid-cols-[1.05fr_0.95fr] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary-foreground">
                  +{REWARD_POINTS} Blitze
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/85">
                  Wochenquest
                </span>
                <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-zinc-950">
                  {currentWeeklyVideo.weekKey}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-black leading-tight">{currentWeeklyVideo.title}</h1>
              <p className="mt-2 text-xl font-black leading-tight text-primary/90">
                {currentWeeklyVideo.missionTitle}
              </p>
              <p className="mt-3 max-w-md text-sm text-white/80">
                Es gibt genau ein Wochenvideo. Du kannst es so oft ansehen, wie du willst, aber die Belohnung gibt es nur einmal.
              </p>

              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <p className="text-xl font-black leading-tight text-white">"{currentWeeklyVideo.quote}"</p>
                <p className="mt-3 text-sm font-semibold text-white">{currentWeeklyVideo.speakerName}</p>
                <p className="text-sm text-white/70">{currentWeeklyVideo.speakerLabel}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Ein Video pro Woche</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Neue Wochenquest alle 2 Wochen</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Belohnung nur 1x</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{currentWeeklyVideo.duration}</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/10 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
              <button
                type="button"
                onClick={() => setIsVideoOpen(true)}
                className="relative block w-full text-left"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={currentWeeklyVideo.image}
                    alt={currentWeeklyVideo.title}
                    className="h-full w-full object-cover opacity-45"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/10 to-transparent" />
                  <div className="absolute left-4 top-4 rounded-full bg-primary/95 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary-foreground">
                    Jetzt ansehen
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
                      <Play className="ml-1 h-8 w-8 fill-current" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4 rounded-xl bg-slate-950/75 px-3 py-1 text-sm font-bold text-white">
                    {currentWeeklyVideo.duration}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </Card>

        <Card className="mt-6 overflow-hidden rounded-[28px] border border-black/5 bg-[linear-gradient(180deg,#ffffff_0%,#f7fff5_100%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-primary">
                <Trophy className="h-5 w-5" />
                <span className="text-sm font-black uppercase tracking-[0.16em]">Wochen-Challenge</span>
              </div>
              <p className="mt-3 text-lg font-black text-foreground">{currentWeeklyVideo.challengeText}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Diese Wochenchallenge erscheint nur alle 2 Wochen. Das Video kannst du oefter ansehen, Punkte gibt es aber nur einmal nach dem vollstaendigen Ansehen.
              </p>
            </div>

            <div className="min-w-[220px] rounded-[24px] bg-white p-4 shadow-[0_12px_24px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 text-amber-600">
                <Zap className="h-4 w-4 fill-current" />
                <span className="text-sm font-black">{currentWeeklyVideo.reward}</span>
              </div>
              <div className="mt-3 rounded-2xl bg-muted/50 px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  {isWeeklyVideoCompleted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Schon geschafft</span>
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 text-primary" />
                      <span>Noch offen</span>
                    </>
                  )}
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={() => setIsVideoOpen(true)}>
                {isWeeklyVideoCompleted ? "Erneut ansehen" : "Video starten"}
              </Button>
            </div>
          </div>

          {isWeeklyVideoCompleted && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Diese Woche ist das Video bereits abgeschlossen. Weitere Aufrufe geben keine zweite Belohnung.
            </div>
          )}
        </Card>

        <Card className="mt-6 overflow-hidden rounded-[28px] border border-[#f3b5da] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="inline-flex rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-700">
                Erste Wochenchallenge
              </span>
              <h2 className="mt-3 text-[2rem] font-black leading-tight text-foreground">
                {currentWeeklyVideo.missionTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {currentWeeklyVideo.missionSubtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsVideoOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-[0_12px_24px_rgba(31,224,102,0.25)]"
            >
              <Play className="h-4 w-4 fill-current" />
              Video ansehen
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {currentWeeklyVideo.missionStops.map((stop) => (
              <div
                key={stop.id}
                className="rounded-[24px] bg-[linear-gradient(135deg,#eefbe9_0%,#dbf7d7_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-white text-foreground shadow-[0_10px_18px_rgba(0,0,0,0.08)]">
                    <Route className="h-8 w-8" />
                  </div>
                  {stop.done ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_18px_rgba(31,224,102,0.24)]">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                  ) : null}
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">{stop.label}</p>
                <p className="mt-1 text-2xl font-black leading-tight text-foreground">{stop.title}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-[28px] border border-black/6 bg-[linear-gradient(180deg,#e9f9d8_0%,#d7f5d0_100%)]">
            <div className="grid gap-5 p-5 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <div className="rounded-[24px] bg-white/70 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.05)]">
                  <div className="mb-3 flex items-center gap-2 text-primary">
                    <Mountain className="h-5 w-5" />
                    <span className="text-sm font-black uppercase tracking-[0.16em]">Tourübersicht</span>
                  </div>
                  <div className="rounded-[22px] bg-[linear-gradient(135deg,#f3ffe9_0%,#daf8d7_100%)] p-4">
                    <div className="flex h-48 items-center justify-center rounded-[18px] border border-primary/15 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.18),transparent_30%),linear-gradient(180deg,#d8f1b8_0%,#b2e48d_100%)]">
                      <div className="relative h-full w-full overflow-hidden rounded-[16px]">
                        <div className="absolute left-[14%] top-[72%] h-5 w-5 rounded-full bg-primary shadow-[0_0_0_6px_rgba(34,197,94,0.15)]" />
                        <div className="absolute right-[18%] top-[28%] h-5 w-5 rounded-full bg-red-500 shadow-[0_0_0_6px_rgba(239,68,68,0.14)]" />
                        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                          <path
                            d="M15 78 C28 66, 36 58, 44 44 S62 22, 82 30"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-black text-fuchsia-700 shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
                          GPX
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="rounded-[24px] bg-white p-4 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-2 text-primary">
                    <MapPin className="h-5 w-5" />
                    <span className="text-sm font-black uppercase tracking-[0.16em]">Tourdaten</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {currentWeeklyVideo.missionStats.map((stat) => (
                      <div key={stat.label} className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                        <span className="text-sm font-semibold text-foreground/70">{stat.label}</span>
                        <span className="text-lg font-black text-foreground">{stat.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                      <span className="text-sm font-semibold text-foreground/70">Ziel</span>
                      <span className="text-lg font-black text-foreground">Schöckl</span>
                    </div>
                  </div>

                  <Button
                    className="mt-5 w-full rounded-2xl"
                    onClick={() => navigate("/challenge/weekly/geotracking")}
                  >
                    Tour vor Ort starten
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{currentWeeklyVideo.title}</DialogTitle>
            <DialogDescription>
              Schau das Video komplett an. Du kannst es spaeter wieder ansehen, aber die Wochenbelohnung wird nur einmal gutgeschrieben.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl bg-black">
              <video
                key={currentWeeklyVideo.id}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full"
                src={currentWeeklyVideo.videoUrl}
                onEnded={() => {
                  void handleVideoCompleted();
                }}
              />
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground">Mitmach-Challenge</p>
              <p className="mt-2 text-sm text-muted-foreground">{currentWeeklyVideo.challengeText}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                <Zap className="h-4 w-4" />
                {isWeeklyVideoCompleted
                  ? "Belohnung fuer diese Woche bereits gutgeschrieben"
                  : `Nach Videoende: +${REWARD_POINTS} Blitze`}
              </div>
              {rewardingVideo && (
                <span className="text-sm text-muted-foreground">Blitze werden gutgeschrieben...</span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default WeeklyAthleteChallenge;
