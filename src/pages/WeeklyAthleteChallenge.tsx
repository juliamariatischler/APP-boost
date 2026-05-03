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
import { getISOWeek } from "date-fns";
import { BOOST_POINT_RULES } from "@/lib/gamification";

const REWARD_POINTS = BOOST_POINT_RULES.weeklyChallengeCompleted;
const VIDEO_REWARD_STORAGE_KEY = "weekly_athlete_video_rewards";

const athletes = [
  {
    id: "sprint-star-lena",
    name: "Anna Gasser",
    knownFor: "Snowboard-Olympiasiegerin",
    sport: "Leichtathletik",
    slogan: "So bleibe ich dran, wenn ich keinen Bock habe.",
    challenge: "3 Runden: 10 Squats, 10 Sekunden Plank, 20 Jumping Jacks",
    reward: `+${REWARD_POINTS} Blitze + Wochenbadge bei Abschluss`,
    videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    duration: "2:48",
  },
  {
    id: "focus-pro-noah",
    name: "Mikaela Shiffrin",
    knownFor: "Ski-Weltcup-Rekordhalterin",
    sport: "Fußball",
    slogan: "Fokus entsteht, wenn du auch an schweren Tagen anfängst.",
    challenge: "2 Aktivblöcke: 10 Push-ups, 10 Squats, 3000 Schritte",
    reward: `+${REWARD_POINTS} Blitze + Wochenbadge bei Abschluss`,
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    duration: "2:12",
  },
  {
    id: "power-pro-mia",
    name: "Simone Biles",
    knownFor: "Turn-Legende",
    sport: "Turnen",
    slogan: "Mut wächst, wenn du dir jede Woche ein neues Ziel setzt.",
    challenge: "Einbeinstand, Linien-Sprünge und danach 10 Sekunden Plank",
    reward: `+${REWARD_POINTS} Blitze + Wochenbadge bei Abschluss`,
    videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    duration: "2:31",
  },
];

const WeeklyAthleteChallenge = () => {
  const calendarWeek = getISOWeek(new Date());
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
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader />

      <div className="mx-auto max-w-screen-xl px-4 pb-8">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-lg">
          <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Wochen-Quest</p>
              <h1 className="mt-2 text-3xl font-bold">Video-Challenge der Woche</h1>
              <p className="mt-3 text-sm text-white/80">
                Hier startet die Wochen-Quest direkt mit einem Motivationsvideo. Danach sehen die Kinder sofort den
                Slogan, die Person dahinter und die Challenge für diese Woche.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Wochenvideo</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Vorbilder</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Klarer Wochenstart</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl">
              <img src={weeklyImg} alt="Wochen-Quest" className="h-full w-full object-cover" />
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {athletes.map((athlete) => (
            <Card key={athlete.name} className="overflow-hidden border-0 bg-[linear-gradient(135deg,#123524_0%,#22c55e_100%)] text-white shadow-lg">
              <button
                type="button"
                onClick={() => setSelectedAthleteId(athlete.id)}
                className="w-full text-left"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,#123524_0%,#22c55e_100%)]">
                  <img src={weeklyImg} alt={athlete.name} className="h-full w-full object-cover opacity-20 mix-blend-screen" />
                  <div className="absolute left-4 top-4 rounded-full bg-yellow-400 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-950">
                    Neu • KW {calendarWeek}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-zinc-950 shadow-[0_20px_40px_rgba(31,224,102,0.32)]">
                      <Play className="ml-1 h-8 w-8 fill-current" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 rounded-lg bg-emerald-950/80 px-2 py-1 text-xs font-bold">
                    {athlete.duration}
                  </div>
                </div>
                <div className="border-t border-white/10 bg-emerald-950/50 p-5">
                  <p className="text-2xl font-black leading-tight text-white">
                    "{athlete.slogan}"
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white">{athlete.name}</p>
                  <p className="text-sm text-white/70">{athlete.knownFor}</p>
                </div>
              </button>

              <div className="p-5 pt-4">
                <div className="rounded-xl bg-emerald-950/30 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Wochen-Challenge</span>
                  </div>
                  <p className="mt-2 text-sm text-white/75">{athlete.challenge}</p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 text-sm font-semibold text-yellow-400">
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
              </div>
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
