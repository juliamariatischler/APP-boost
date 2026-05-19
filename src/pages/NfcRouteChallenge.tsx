import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Nfc,
  Trophy,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TopHeader } from "@/components/TopHeader";
import { supabase } from "@/integrations/supabase/client";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { readNfcTag } from "@/lib/nfc";
import {
  getActiveRoute,
  getRouteProgress,
  recordNfcScan,
  type NfcRouteWithStations,
  type NfcRouteProgress,
  type NfcStation,
} from "@/lib/nfcRouteService";

const NfcRouteChallenge = () => {
  const { session: codeSession } = useCodeAuth();
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  const [route, setRoute] = useState<NfcRouteWithStations | null>(null);
  const [progress, setProgress] = useState<NfcRouteProgress | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (codeSession?.device_id) setDeviceId(codeSession.device_id);
    if (codeSession?.session_token) setSessionToken(codeSession.session_token);
  }, [codeSession]);

  const refreshProgress = useCallback(
    async (routeId: string) => {
      const prog = await getRouteProgress(routeId, deviceId, sessionToken);
      setProgress(prog);
    },
    [deviceId, sessionToken],
  );

  useEffect(() => {
    const load = async () => {
      setLoadingRoute(true);
      try {
        // Try Supabase auth first (sets deviceId irrelevant for Supabase users)
        if (!codeSession) {
          await supabase.auth.getSession();
        }
        const activeRoute = await getActiveRoute();
        setRoute(activeRoute);
        if (activeRoute) {
          await refreshProgress(activeRoute.id);
        }
      } catch {
        toast.error("Route konnte nicht geladen werden.");
      } finally {
        setLoadingRoute(false);
      }
    };
    void load();
  }, [deviceId, codeSession, refreshProgress]);

  const handleScan = async () => {
    if (scanning || !route || progress?.is_complete) return;
    setScanning(true);
    try {
      const tagRead = await readNfcTag("Halte dein iPhone an die Station");

      if (tagRead.status === "cancelled") return;

      if (tagRead.status === "unavailable") {
        toast.error("NFC nicht verfügbar auf diesem Gerät.");
        return;
      }

      if (tagRead.status === "error") {
        toast.error("NFC-Chip konnte nicht gelesen werden. Bitte erneut versuchen.");
        return;
      }

      const result = await recordNfcScan(tagRead.tagId, deviceId, sessionToken);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      switch (result.status) {
        case "scanned":
          toast.success(
            `${result.station_name} gescannt! ${result.scanned_count} von ${result.total_count} Stationen erledigt.`,
          );
          break;
        case "duplicate":
          toast.info(`${result.station_name} wurde bereits gescannt.`);
          break;
        case "complete":
          toast.success(
            `Alle Stationen abgeschlossen! +${result.points_reward} Blitze`,
          );
          window.dispatchEvent(
            new CustomEvent("points-updated", {
              detail: { delta: result.points_reward },
            }),
          );
          break;
        case "already_complete":
          toast.info("Diese Route hast du bereits vollständig abgeschlossen.");
          break;
      }

      await refreshProgress(route.id);
    } catch {
      toast.error("Scan fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setScanning(false);
    }
  };

  const stationDone = (station: NfcStation): boolean =>
    progress?.scanned_station_ids?.includes(station.id) ?? false;

  const scannedCount = progress?.scanned_count ?? 0;
  const totalCount = progress?.total_count ?? (route?.stations.length ?? 0);
  const isComplete = progress?.is_complete ?? false;
  const progressPercent = totalCount > 0 ? Math.round((scannedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader backTo="/challenge/weekly" />

      <div className="mx-auto max-w-screen-xl space-y-4 px-4 pb-8">

        {/* Hero card */}
        <Card className="overflow-hidden rounded-[28px] border-0 bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 text-white shadow-lg">
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-[0.18em]">
                Wochenchallenge
              </span>
              <span className="rounded-full bg-sky-400/30 px-3 py-1 text-xs font-black uppercase tracking-[0.18em]">
                NFC-Route
              </span>
            </div>

            {loadingRoute ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-8 w-3/4 bg-white/20" />
                <Skeleton className="h-4 w-full bg-white/10" />
              </div>
            ) : route ? (
              <>
                <h1 className="mt-3 text-3xl font-black leading-tight">{route.name}</h1>
                {route.description && (
                  <p className="mt-2 text-sm text-white/80">{route.description}</p>
                )}
              </>
            ) : (
              <p className="mt-3 text-white/70">Keine aktive Route gefunden.</p>
            )}

            {/* Progress bar */}
            {!loadingRoute && route && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-white/80">Fortschritt</span>
                  <span className={isComplete ? "text-green-300" : "text-white"}>
                    {scannedCount} von {totalCount} Stationen
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-green-400 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Reward badge */}
            {!loadingRoute && route && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2">
                <Zap className="h-4 w-4 fill-yellow-300 text-yellow-300" />
                <span className="text-sm font-black">+{route.points_reward} Blitze bei Abschluss</span>
              </div>
            )}
          </div>
        </Card>

        {/* Station list */}
        {!loadingRoute && route ? (
          <Card className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">
              Stationen
            </p>

            <div className="mt-4 space-y-3">
              {route.stations.map((station, index) => {
                const done = stationDone(station);
                return (
                  <div
                    key={station.id}
                    className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-colors ${
                      done
                        ? "border-green-200 bg-green-50"
                        : "border-sky-100 bg-sky-50/60"
                    }`}
                  >
                    {/* Order badge */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                        done
                          ? "bg-green-100 text-green-600"
                          : "bg-sky-100 text-sky-600"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Station {index + 1}
                      </p>
                      <p className="mt-0.5 text-base font-black text-foreground">
                        {station.name}
                      </p>
                    </div>

                    {done && (
                      <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-black text-green-600">
                        ✓ Gescannt
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Completion state */}
            {isComplete && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
                <Trophy className="h-6 w-6 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-black text-green-700">Route abgeschlossen!</p>
                  <p className="mt-0.5 text-xs text-green-600">
                    Du hast alle {totalCount} Stationen gescannt und {route.points_reward} Blitze erhalten.
                  </p>
                </div>
              </div>
            )}

            {/* Scan button */}
            {!isComplete && (
              <Button
                className="mt-6 w-full gap-2 rounded-2xl py-6 text-base font-black shadow-[0_12px_28px_rgba(31,224,102,0.3)]"
                onClick={() => void handleScan()}
                disabled={scanning || loadingRoute}
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Warte auf NFC-Chip…
                  </>
                ) : (
                  <>
                    <Nfc className="h-5 w-5" />
                    Station scannen
                  </>
                )}
              </Button>
            )}

            {!isComplete && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Halte dein iPhone direkt an den NFC-Chip der Station.
              </p>
            )}
          </Card>
        ) : !loadingRoute && !route ? (
          <Card className="rounded-[28px] border border-black/5 bg-white p-8 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <Nfc className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-semibold text-muted-foreground">
              Aktuell ist keine NFC-Route aktiv.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Schau später wieder vorbei!
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default NfcRouteChallenge;
