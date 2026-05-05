import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopHeader } from "@/components/TopHeader";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Compass, MapPin, NotebookPen, Search, Zap } from "lucide-react";

const POINTS_PER_FIND = 50;
const STORAGE_KEY = "weekly_geocaching_finds";

const caches = [
  {
    code: "SCHOECKL-START",
    name: "Startpunkt-Cache",
    area: "St. Radegund / Start",
    hint: "Finde den ersten Marker am Start der Tour und achte auf den Wegweiser.",
  },
  {
    code: "SCHOECKL-WEG",
    name: "Weg-Cache",
    area: "Schöckl / Unterwegs",
    hint: "Halte am Weg nach dem nächsten Marker Ausschau. Bleib auf der Route.",
  },
  {
    code: "SCHOECKL-ZIEL",
    name: "Ziel-Cache",
    area: "Alpengasthof am Schöckl",
    hint: "Am Ziel wartet der letzte Marker. Schau in der Nähe des Zielbereichs.",
  },
] as const;

const WeeklyGeoTracking = () => {
  const [manualCode, setManualCode] = useState("");
  const [foundCodes, setFoundCodes] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const foundCaches = useMemo(
    () =>
      foundCodes.map((code) => {
        const match = caches.find((cache) => cache.code === code);
        return {
          code,
          name: match?.name || "Unbekannter Cache",
          area: match?.area || "Unbekannter Bereich",
        };
      }),
    [foundCodes]
  );

  const persistFinds = (codes: string[]) => {
    setFoundCodes(codes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  };

  const awardPoints = async () => {
    const { error } = await supabase.rpc("increment_points", { points_to_add: POINTS_PER_FIND });

    if (error) {
      throw error;
    }

    window.dispatchEvent(new CustomEvent("points-updated", { detail: { delta: POINTS_PER_FIND } }));
  };

  const handleCode = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    const cache = caches.find((entry) => entry.code === code);

    if (!cache) {
      toast.error("Dieser Fundcode gehört aktuell nicht zu unserer Geocaching-Challenge.");
      return;
    }

    if (foundCodes.includes(code)) {
      toast.error("Diesen Cache hast du bereits geloggt.");
      return;
    }

    try {
      const isFirstFind = foundCodes.length === 0;
      if (isFirstFind) {
        await awardPoints();
      }
      const nextCodes = [...foundCodes, code];
      persistFinds(nextCodes);
      toast.success(
        isFirstFind
          ? `Wochenchallenge geloggt! +${POINTS_PER_FIND} Blitze`
          : "Cache geloggt! Fortschritt in der Wochenchallenge aktualisiert."
      );
    } catch (error) {
      console.error("Geocaching award failed", error);
      toast.error("Fund erkannt, aber die Blitze konnten nicht gutgeschrieben werden.");
    }
  };

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) return;
    await handleCode(manualCode);
    setManualCode("");
  };

  const RewardPill = ({ points }: { points: number }) => (
    <div className="inline-flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 text-primary">
      <Zap className="h-4 w-4 fill-primary text-primary" />
      <span className="text-2xl font-black leading-none">{points}</span>
      <span className="text-base font-semibold">Blitze</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader backTo="/quests" />

      <div className="mx-auto max-w-screen-xl px-4 pb-8">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-emerald-600 to-teal-600 text-white shadow-lg">
          <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Wochenchallenge vor Ort</p>
            <h1 className="mt-2 text-3xl font-bold">Wanderung: Alpengasthof am Schöckl</h1>
            <p className="mt-3 max-w-3xl text-sm text-white/85">
              Schau zuerst das Wochenvideo an und starte dann die Tour. Unterwegs findest du Marker auf der Strecke
              und loggst sie danach in BOOST.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">12,5 km Tour</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Marker am Weg</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold inline-flex items-center gap-1">
                <Zap className="h-3 w-3 fill-white text-white" />
                Erster Fund = {POINTS_PER_FIND} Blitze
              </span>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Marker finden und loggen</h2>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Diese Wochenchallenge läuft als echte Tour. Vor Ort findest du Marker oder Fundcodes und trägst sie
              danach hier ein.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">1. Ort ansteuern</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Starte die Wanderung am ausgeschriebenen Startpunkt Richtung Schöckl.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">2. Marker finden</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Unterwegs findest du Marker am Start, am Weg oder am Ziel der Challenge.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <NotebookPen className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">3. Fund eintragen</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Danach wird der Fundcode in BOOST eingetragen. Der erste valide Fund bringt die Wochenbelohnung.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Fundcode eingeben</p>
                <RewardPill points={POINTS_PER_FIND} />
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  placeholder="z. B. SCHOECKL-START"
                />
                <Button onClick={() => void handleManualSubmit()}>Loggen</Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Challenge-Stationen</h2>
              </div>
              <RewardPill points={foundCodes.length > 0 ? POINTS_PER_FIND : 0} />
            </div>

            <div className="mt-4 space-y-3">
              {caches.map((cache) => {
                const isFound = foundCodes.includes(cache.code);

                return (
                  <div key={cache.code} className="rounded-xl border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{cache.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {cache.area} · {cache.code}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          isFound
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isFound ? "Gefunden" : "Offen"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{cache.hint}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground">Bereits geloggte Funde</p>
              <div className="mt-3 space-y-2">
                {foundCaches.length > 0 ? (
                  foundCaches.map((cache) => (
                    <div key={cache.code} className="rounded-lg border bg-background px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{cache.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cache.area} · {cache.code}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Noch keine Caches geloggt.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default WeeklyGeoTracking;
