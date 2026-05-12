import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/friendquest1.svg";
import tryitImg from "@/assets/challenge-tryit.jpg";
import tryitSportsAvatarImg from "@/assets/quest-tryit-sports-avatar.png";
import weeklyHikerAvatarImg from "@/assets/quest-weekly-hiker-avatar.png";
import weeklyGeoAvatarImg from "@/assets/quest-weekly-geo-avatar.png";
import TrialSessionsList from "@/components/TrialSessionsList";
import { DailyChallengeContent } from "@/components/DailyChallengeContent";
import { TopHeader } from "@/components/TopHeader";
import { BottomNav } from "@/components/BottomNav";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  MapPin,
  Nfc,
  Package,
  Play,
  Search,
  Sparkles,
  TreePine,
  Trophy,
  Zap,
} from "lucide-react";
import { BOOST_POINT_RULES } from "@/lib/gamification";
import { AVATAR_BASE_ASSET } from "@/lib/avatarItems";
import { scanForStation } from "@/lib/nfc";

const challengeData: Record<string, { title: string; image: string; description: string }> = {
  daily: {
    title: "Tägliche Challenge",
    image: dailyImg,
    description: "Kurze, kindgerechte Bewegungsimpulse mit reduzierten Wiederholungen und rotierendem Trainingsfokus. Unsere Übungen basieren auf internationalen Trainingsrichtlinien für Kinder und sind speziell auf Sicherheit, Einfachheit und Skalierbarkeit ausgelegt.",
  },
  weekly: {
    title: "2-Wochen-Mission",
    image: weeklyImg,
    description: `Schaffe die beschriebene Challenge und erhalte ${BOOST_POINT_RULES.weeklyChallengeCompleted} Blitze.`,
  },
  friend: {
    title: "Friendquest Challenge",
    image: friendImg,
    description: "Fordere deine Freunde heraus und habt zusammen Spaß an der Bewegung!",
  },
  tryit: {
    title: "Try It Challenge",
    image: tryitImg,
    description: `Ein gemeinsames Try-It-System mit echten Sportarten, Vereinsnähe und +${BOOST_POINT_RULES.tryItCompleted} Blitzen pro neuem Erlebnis.`,
  },
};

// Placeholder station data – update lat/lng with real coordinates before deploying
const SCHATZSUCHE_STATIONS = [
  { id: "station_1", label: "Station 1", lat: 46.8523, lng: 15.8726 },
  { id: "station_2", label: "Station 2", lat: 46.8531, lng: 15.8740 },
  { id: "station_3", label: "Station 3", lat: 46.8518, lng: 15.8752 },
] as const;

const Blitz3D = ({ className = "" }: { className?: string }) => (
  <span className={`relative inline-flex shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(145deg,#baff76_0%,#61dc70_46%,#22a64a_100%)] text-white shadow-[0_9px_14px_rgba(31,224,102,0.34),0_3px_0_rgba(20,120,52,0.28),inset_0_2px_2px_rgba(255,255,255,0.68),inset_0_-3px_5px_rgba(0,0,0,0.18)] ${className}`}>
    <span className="absolute left-1.5 top-1 h-2 w-3 rounded-full bg-white/45 blur-[1px]" />
    <Zap className="relative h-[62%] w-[62%] fill-current drop-shadow-[0_2px_2px_rgba(0,0,0,0.24)]" />
  </span>
);

const QuestBuddy = () => {
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <div className="absolute inset-2 rounded-[36px] bg-[radial-gradient(circle_at_36%_28%,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.72)_34%,rgba(97,220,112,0.16)_100%)] shadow-[0_18px_34px_rgba(31,224,102,0.20),inset_0_2px_0_rgba(255,255,255,0.85),inset_0_-4px_10px_rgba(0,0,0,0.08)]" />
      <div className="absolute right-0 top-2 h-9 w-9 rounded-full bg-[linear-gradient(145deg,#ffcf5a_0%,#ff8a3d_100%)] shadow-[0_8px_16px_rgba(249,115,22,0.28),inset_0_2px_0_rgba(255,255,255,0.65)]">
        <span className="absolute left-2 top-2 h-2 w-3 rounded-full bg-white/55 blur-[1px]" />
      </div>
      <div className="absolute left-2 top-5 h-5 w-10 -rotate-12 rounded-full border-2 border-white/80 bg-sky-300/80 shadow-[0_8px_14px_rgba(14,165,233,0.18)]" />
      <img
        src={AVATAR_BASE_ASSET}
        alt=""
        aria-hidden="true"
        className="relative z-10 h-[5.7rem] w-[5.7rem] object-contain drop-shadow-[0_14px_18px_rgba(15,23,42,0.18)]"
      />
      <div className="absolute bottom-2 right-4 z-20">
        <Blitz3D className="h-8 w-8 rotate-6" />
      </div>
    </div>
  );
};

const TrackPlaceholder = () => (
  <div className="mx-5 mb-5 mt-3 overflow-hidden rounded-[16px] border border-sky-100/80 bg-[linear-gradient(135deg,#e0f2fe_0%,#eff6ff_100%)]">
    <div className="relative flex h-28 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 112" preserveAspectRatio="none">
        <path
          d="M 20 95 C 60 88, 72 28, 122 48 S 198 78, 242 38 S 276 14, 286 17"
          stroke="#bae6fd"
          strokeWidth="3"
          fill="none"
          strokeDasharray="8 5"
        />
        <circle cx="20" cy="95" r="5" fill="#0ea5e9" fillOpacity="0.55" />
        <circle cx="122" cy="48" r="5" fill="#0ea5e9" fillOpacity="0.55" />
        <circle cx="286" cy="17" r="5" fill="#0ea5e9" fillOpacity="0.55" />
      </svg>
      <div className="relative z-10 flex flex-col items-center gap-1 text-center">
        <MapPin className="h-5 w-5 text-sky-400" />
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-500">Track</p>
        <p className="text-[9px] text-sky-400/80">Routenbild hier einfügen</p>
      </div>
    </div>
  </div>
);

const ChallengeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [completedStations, setCompletedStations] = useState<Set<string>>(new Set());
  const [scanningStation, setScanningStation] = useState<string | null>(null);
  const [showScanSection, setShowScanSection] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!userId || id !== "weekly") return;
    const load = async () => {
      const { data } = await (supabase.from("station_scans") as any)
        .select("station_id")
        .eq("user_id", userId)
        .eq("challenge_id", "schatzsuche");
      if (data) setCompletedStations(new Set(data.map((d: any) => d.station_id as string)));
    };
    void load();
  }, [userId, id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    setUserId(session.user.id);
  };

  const openInMaps = (lat: number, lng: number, label: string) => {
    const url =
      Capacitor.getPlatform() === "ios"
        ? `maps://?q=${encodeURIComponent(label)}&ll=${lat},${lng}`
        : `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, "_blank");
  };

  const handleScanStation = async (stationId: string, label: string) => {
    if (scanningStation || completedStations.has(stationId)) return;
    setScanningStation(stationId);
    try {
      const result = await scanForStation({
        expectedStationId: stationId,
        alertMessage: `Halte dein iPhone an ${label}`,
      });
      if (result === "success") {
        if (userId) {
          await (supabase.from("station_scans") as any).upsert({
            user_id: userId,
            challenge_id: "schatzsuche",
            station_id: stationId,
          });
        }
        setCompletedStations((prev) => new Set([...prev, stationId]));
        toast.success(`${label} erfolgreich gescannt! ✓`);
      } else if (result === "wrong_tag") {
        toast.error("Falsche Station – bitte scanne die richtige Station.");
      } else if (result === "unavailable") {
        toast.error("NFC nicht verfügbar auf diesem Gerät.");
      }
    } catch {
      toast.error("Scan fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setScanningStation(null);
    }
  };

  const challenge = id ? challengeData[id] : null;
  const headerReward =
    id === "tryit"
      ? BOOST_POINT_RULES.tryItCompleted
      : id === "friend"
        ? BOOST_POINT_RULES.friendQuestCompleted
        : BOOST_POINT_RULES.weeklyChallengeCompleted;

  if (!challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Challenge nicht gefunden</p>
      </div>
    );
  }

  const isTryIt = id === "tryit";
  const isWeekly = id === "weekly";

  return (
    <div className={`min-h-screen pb-nav-safe ${isTryIt ? "bg-[#FFFDF4]" : "bg-background"}`}>
      {!isTryIt && <TopHeader hideNav />}

      <div className={`max-w-screen-xl mx-auto px-4 pb-8 ${isTryIt ? "pt-[0.4cm]" : ""}`}>
        {id === "daily" && userId ? (
          <DailyChallengeContent userId={userId} />
        ) : isWeekly ? (
          <div className="space-y-3">
            {/* Hero Card */}
            <Card className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-0 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
              <div className="grid min-h-[15rem] grid-cols-[minmax(0,1fr)_42%] overflow-hidden bg-[#f6fbf2]">
                <div className="flex flex-col justify-center gap-3 px-5 py-6">
                  <span className="w-fit rounded-full bg-primary/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                    Fordere dich selbst heraus
                  </span>
                  <h1 className="text-[2rem] font-black leading-[0.92] tracking-tight text-foreground">
                    2-Wochen-<br />Mission
                  </h1>
                  <p className="max-w-[13rem] text-sm leading-snug text-muted-foreground">
                    Schaffe die beschriebene Challenge und erhalte {BOOST_POINT_RULES.weeklyChallengeCompleted} Blitze.
                  </p>
                  <div className="mt-1 flex w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-5 py-3 text-white shadow-[0_12px_28px_rgba(31,224,102,0.35),0_4px_0_rgba(16,110,42,0.28),inset_0_2px_0_rgba(255,255,255,0.22)]">
                    <Zap className="h-5 w-5 fill-current" />
                    <div className="flex flex-col leading-none">
                      <span className="text-2xl font-black">{BOOST_POINT_RULES.weeklyChallengeCompleted}</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em]">Blitze</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-end gap-2 py-4 pl-1 pr-3">
                  <img
                    src={weeklyHikerAvatarImg}
                    alt=""
                    aria-hidden="true"
                    className="w-full flex-1 scale-[1.25] origin-bottom object-contain object-bottom drop-shadow-[0_18px_24px_rgba(15,23,42,0.16)]"
                  />
                  <div className="w-full rounded-[14px] bg-[linear-gradient(145deg,#e8e8e8_0%,#d0d0d0_50%,#b8b8b8_100%)] px-3 py-2 text-center shadow-[0_6px_16px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-2px_4px_rgba(0,0,0,0.12)]">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-black/50">Bonus</p>
                    <p className="text-[13px] font-black text-black/80">+ Avatar-Item</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Mission 1 – Schatzsuche */}
            <Card className="overflow-hidden rounded-[24px] border-2 border-sky-200 bg-white p-0 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
              {/* Header grid */}
              <div className="relative grid grid-cols-[minmax(0,1fr)_155px]">
                <div className="p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">Mission 1</p>
                  <h3 className="mt-2 text-xl font-black text-foreground">Schatzsuche</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Finde Orte draussen und sammle Funde.</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 rounded-2xl bg-[#f3f8ff] px-3 py-2 text-sm font-semibold text-foreground">
                      <TreePine className="h-4 w-4 text-sky-500" />
                      Rausgehen
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-[#f3f8ff] px-3 py-2 text-sm font-semibold text-foreground">
                      <Search className="h-4 w-4 text-sky-500" />
                      Versteck finden
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowScanSection((v) => !v)}
                      className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                        showScanSection
                          ? "bg-sky-500 text-white shadow-[0_4px_12px_rgba(14,165,233,0.28)]"
                          : "bg-[#f3f8ff] text-foreground"
                      }`}
                    >
                      <Nfc className={`h-4 w-4 shrink-0 ${showScanSection ? "text-white" : "text-sky-500"}`} />
                      <span className="flex-1">Station scannen</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                          showScanSection ? "rotate-180 text-white" : "text-sky-400"
                        }`}
                      />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/challenge/weekly/geotracking")}
                    className="mt-5 text-sm font-black text-primary"
                  >
                    Jetzt starten →
                  </button>
                </div>
                <div className="relative overflow-hidden">
                  <div className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <img
                    src={weeklyGeoAvatarImg}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-[1.25] origin-bottom object-contain object-bottom drop-shadow-[0_12px_18px_rgba(15,23,42,0.14)]"
                  />
                </div>
              </div>

              {/* NFC Scan Stations – animated reveal */}
              <AnimatePresence initial={false}>
                {showScanSection && (
              <motion.div
                key="scan-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
              <div className="border-t border-sky-100 px-5 pb-2 pt-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-sky-600">Scan Station</p>
                <div className="space-y-2">
                  {SCHATZSUCHE_STATIONS.map((station) => {
                    const isDone = completedStations.has(station.id);
                    const isScanning = scanningStation === station.id;
                    return (
                      <div
                        key={station.id}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
                          isDone ? "border-green-200 bg-green-50" : "border-sky-200 bg-[#f3f8ff]"
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            isDone ? "bg-green-100" : "bg-sky-100"
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Package className="h-4 w-4 text-sky-500" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{station.label}</p>
                          <button
                            type="button"
                            onClick={() => openInMaps(station.lat, station.lng, station.label)}
                            className="mt-0.5 flex items-center gap-1 text-[10px] text-sky-500 active:text-sky-700"
                          >
                            <MapPin className="h-2.5 w-2.5" />
                            {station.lat.toFixed(4)}° N, {station.lng.toFixed(4)}° E
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleScanStation(station.id, station.label)}
                          disabled={isDone || isScanning}
                          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all active:scale-95 ${
                            isDone
                              ? "cursor-default bg-green-100 text-green-600"
                              : isScanning
                                ? "bg-sky-100 text-sky-500"
                                : "bg-sky-500 text-white shadow-[0_4px_12px_rgba(14,165,233,0.3)]"
                          }`}
                        >
                          {isScanning ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Scanne…
                            </>
                          ) : isDone ? (
                            "Gescannt ✓"
                          ) : (
                            <>
                              <Nfc className="h-3.5 w-3.5" />
                              Scan NFC
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Track image placeholder */}
              <TrackPlaceholder />
              </motion.div>
              )}
              </AnimatePresence>
            </Card>

            {/* Mission 2 – Coming Soon */}
            <Card className="relative overflow-hidden rounded-[24px] border border-black/5 bg-[#f5f5f5] p-0 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground/70">Mission 2</p>
                    <h3 className="mt-2 text-xl font-black text-foreground">Video-Mission</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Schau ein Sportler-Video und mach mit.</p>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-foreground/80">
                        <Play className="h-4 w-4 text-muted-foreground/60" />
                        Video schauen
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-foreground/80">
                        <Trophy className="h-4 w-4 text-muted-foreground/60" />
                        Challenge nachmachen
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-foreground/80">
                        <Zap className="h-4 w-4 text-muted-foreground/60" />
                        Blitze holen
                      </div>
                    </div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-muted-foreground shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                    <Play className="ml-0.5 h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-10 top-10 w-44 rotate-[38deg] bg-[#a0a0a0] py-1.5 text-center text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
                  COMING SOON
                </div>
              </div>
            </Card>
          </div>
        ) : isTryIt ? (
          <>
            <div className="relative overflow-hidden rounded-[32px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.09),inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="pointer-events-none absolute right-[22%] top-7 text-xl text-yellow-400 drop-shadow-[0_0_6px_rgba(253,224,71,0.5)]">✦</div>
              <div className="pointer-events-none absolute right-[10%] top-4 text-sm text-yellow-300">✦</div>
              <div className="pointer-events-none absolute right-[16%] bottom-14 text-xs text-yellow-400/70">✦</div>
              <img
                src={tryitSportsAvatarImg}
                alt=""
                aria-hidden="true"
                className="absolute right-0 top-[0.5rem] z-0 h-[13rem] w-[13rem] object-contain object-top drop-shadow-[0_18px_24px_rgba(15,23,42,0.12)]"
              />
              <div className="relative z-10 px-7 pt-7">
                <div className="max-w-[58%]">
                  <h1 className="text-[2rem] font-black leading-[0.92] tracking-tight text-foreground">
                    Try It<br />Challenge
                  </h1>
                  <p className="mt-3 text-sm leading-snug text-muted-foreground">
                    {challenge.description}
                  </p>
                </div>
              </div>
              <div className="relative z-10 px-7 pb-7 pt-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                  <Zap className="h-4 w-4 fill-primary text-primary" />
                  <span className="whitespace-nowrap text-sm font-black text-foreground">
                    <span className="text-primary">+{BOOST_POINT_RULES.tryItCompleted}</span> Blitze pro neuem Erlebnis
                  </span>
                </div>
              </div>
            </div>
            <TrialSessionsList />
          </>
        ) : (
          <Card className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-0 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.72)_0%,transparent_34%),linear-gradient(135deg,#8ee6ff_0%,#7ce582_48%,#fff3a3_100%)]">
              <div className="grid grid-cols-[minmax(0,1fr)_132px]">
                <div className="relative min-h-[13.5rem] overflow-hidden">
                  <img
                    src={challenge.image}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover opacity-58 mix-blend-multiply saturate-125"
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.46)_0%,transparent_32%),linear-gradient(90deg,rgba(15,23,42,0.34)_0%,rgba(15,23,42,0.08)_66%,rgba(255,255,255,0.72)_100%)]" />
                  <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-primary/45 blur-2xl" />
                  <div className="absolute bottom-4 right-5 h-9 w-9 rounded-full bg-yellow-300/75 shadow-[0_8px_18px_rgba(250,204,21,0.25)]" />
                  <div className="absolute left-5 top-5 rounded-full bg-white/22 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur">
                    Quest
                  </div>
                  <div className="absolute bottom-5 left-5 right-6">
                    <h1 className="max-w-[12.5rem] text-[1.72rem] font-black leading-[0.95] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.28)]">
                      {challenge.title}
                    </h1>
                    <p className="mt-2 max-w-[13rem] text-sm font-bold leading-snug text-white/92">
                      {challenge.description}
                    </p>
                  </div>
                </div>
                <div className="relative flex flex-col items-center justify-center px-2 py-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_42%,rgba(255,255,255,0.86)_0%,rgba(255,255,255,0.48)_54%,transparent_84%)]" />
                  <QuestBuddy />
                  <p className="relative -mt-1 flex items-center gap-1 text-xs font-black text-foreground/70">
                    +{headerReward}
                    <Blitz3D className="h-6 w-6" />
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ChallengeDetail;
