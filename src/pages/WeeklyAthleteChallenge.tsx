import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopHeader } from "@/components/TopHeader";
import { BottomNav } from "@/components/BottomNav";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import { CheckCircle2, Play, Trophy, Zap } from "lucide-react";

const REWARD_POINTS = 15;
const VIDEO_REWARD_STORAGE_KEY = "weekly_athlete_video_rewards";

const athletes = [
  {
    id: "sprint-star-lena",
    name: "Sprint-Star Lena",
    sport: "Leichtathletik",
    message: "Schnell werden heißt nicht nur rennen. Es heißt mutig starten und jeden Tag dranbleiben.",
    challenge: "3 Runden: 10 Squats, 10 Sekunden Plank, 20 Jumping Jacks",
    reward: `+${REWARD_POINTS} Blitze bei Abschluss`,
    videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    id: "goalgetter-noah",
    name: "Goalgetter Noah",
    sport: "Fußball",
    message: "Große Spiele gewinnst du mit Energie, Fokus und Wiederholung.",
    challenge: "2 Aktivblöcke: 10 Push-ups, 10 Squats, 3000 Schritte",
    reward: `+${REWARD_POINTS} Blitze bei Abschluss`,
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "power-pro-mia",
    name: "Power-Pro Mia",
    sport: "Turnen",
    message: "Koordination macht dich stark. Fang klein an und werde jeden Tag sicherer.",
    challenge: "Einbeinstand, Linien-Sprünge und danach 10 Sekunden Plank",
    reward: `+${REWARD_POINTS} Blitze bei Abschluss`,
    videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4",
  },
];

const WeeklyAthleteChallenge = () => {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [completedAthleteIds, setCompletedAthleteIds] = useState<string[]>([]);
  const [rewardingAthleteId, setRewardingAthleteId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
      const stored = localStorage.getItem(`${VIDEO_REWARD_STORAGE_KEY}_${userId}`);
      setCompletedAthleteIds(stored ? JSON.parse(stored) : []);
    } catch {
      setCompletedAthleteIds([]);
    }
  }, [userId]);

  const selectedAthlete = useMemo(
    () => athletes.find((athlete) => athlete.id === selectedAthleteId) ?? null,
    [selectedAthleteId]
  );

  const persistCompletedAthletes = (athleteIds: string[]) => {
    setCompletedAthleteIds(athleteIds);

    if (!userId) return;

    localStorage.setItem(`${VIDEO_REWARD_STORAGE_KEY}_${userId}`, JSON.stringify(athleteIds));
  };

  const handleVideoCompleted = async () => {
    if (!selectedAthlete || !userId) {
      toast.error("Bitte melde dich an, damit wir dir die Blitze gutschreiben können.");
      return;
    }

    if (completedAthleteIds.includes(selectedAthlete.id)) {
      toast.success("Dieses Challenge-Video hast du bereits abgeschlossen.");
      return;
    }

    setRewardingAthleteId(selectedAthlete.id);

    try {
      const { error } = await supabase.rpc("increment_points", { points_to_add: REWARD_POINTS });

      if (error) {
        throw error;
      }

      const nextCompletedAthleteIds = [...completedAthleteIds, selectedAthlete.id];
      persistCompletedAthletes(nextCompletedAthleteIds);
      window.dispatchEvent(new CustomEvent("points-updated", { detail: { delta: REWARD_POINTS } }));
      toast.success(`Challenge abgeschlossen! +${REWARD_POINTS} Blitze`);
    } catch (error) {
      console.error("Video reward failed", error);
      toast.error("Video beendet, aber die Blitze konnten nicht gutgeschrieben werden.");
    } finally {
      setRewardingAthleteId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <TopHeader />

      <div className="mx-auto max-w-screen-xl px-4 pb-8">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-lg">
          <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Option A</p>
              <h1 className="mt-2 text-3xl font-bold">Spitzensportler-Challenge</h1>
              <p className="mt-3 text-sm text-white/80">
                Hier sehen die Kinder die Challenge eines Spitzensportlers, lassen sich motivieren und starten direkt in
                einen klaren Bewegungsauftrag.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Motivationsvideo</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Vorbilder</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Emotionale Aktivierung</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl">
              <img src={weeklyImg} alt="Spitzensportler-Challenge" className="h-full w-full object-cover" />
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {athletes.map((athlete) => (
            <Card key={athlete.name} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{athlete.sport}</p>
                  <h2 className="mt-1 text-xl font-bold text-foreground">{athlete.name}</h2>
                </div>
                <div className="rounded-full bg-primary/10 p-3">
                  <Play className="h-5 w-5 text-primary" />
                </div>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{athlete.message}</p>

              <div className="mt-4 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Challenge</span>
                </div>
                <p className="mt-2 text-sm text-foreground">{athlete.challenge}</p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm font-semibold text-yellow-600">
                  <Zap className="h-4 w-4" />
                  <span>{athlete.reward}</span>
                </div>
                <Button onClick={() => setSelectedAthleteId(athlete.id)}>
                  {completedAthleteIds.includes(athlete.id) ? "Erneut ansehen" : "Challenge ansehen"}
                </Button>
              </div>

              {completedAthleteIds.includes(athlete.id) && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Video abgeschlossen. Blitze bereits erhalten.
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(selectedAthlete)} onOpenChange={(open) => !open && setSelectedAthleteId(null)}>
        <DialogContent className="sm:max-w-3xl">
          {selectedAthlete && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAthlete.name}</DialogTitle>
                <DialogDescription>
                  Sieh dir das Video an, mach direkt mit und sichere dir die Blitze erst nach dem vollständigen Abspielen.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl bg-black">
                  <video
                    key={selectedAthlete.id}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full"
                    src={selectedAthlete.videoUrl}
                    onEnded={() => {
                      void handleVideoCompleted();
                    }}
                  />
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm font-semibold text-foreground">Mitmach-Challenge</p>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedAthlete.challenge}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                    <Zap className="h-4 w-4" />
                    {completedAthleteIds.includes(selectedAthlete.id)
                      ? "Belohnung bereits gutgeschrieben"
                      : `Nach Videoende: +${REWARD_POINTS} Blitze`}
                  </div>
                  {rewardingAthleteId === selectedAthlete.id && (
                    <span className="text-sm text-muted-foreground">Blitze werden gutgeschrieben...</span>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default WeeklyAthleteChallenge;
