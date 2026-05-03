import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, ChevronRight, HeartPulse, LogOut, School, Settings2, ShieldCheck, User2, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LevelCard } from "@/components/boost/LevelCard";
import { HealthService } from "@/services/healthService";
import { supabase } from "@/integrations/supabase/client";
import { getDemoAwarePoints } from "@/lib/demo";
import { getLevelForPoints } from "@/lib/gamification";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";

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

        const [{ data: profileData }, healthStatus] = await Promise.all([
          supabase
            .from("profiles")
            .select("username, school, class, points")
            .eq("id", session.user.id)
            .single(),
          HealthService.isAvailable().catch(() => false),
        ]);

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
      <div className="min-h-screen bg-[#f6f4ee] pb-nav-safe">
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
    <div className="min-h-screen bg-[#f6f4ee] pb-nav-safe">
      <div className="mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <img src={boostLogo} alt="BOOST Logo" className="h-12 w-auto" />
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-foreground shadow-[0_10px_25px_rgba(0,0,0,0.08)]"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>

        <Card className="mb-4 overflow-hidden rounded-[30px] border-0 bg-[linear-gradient(135deg,#ffffff_0%,#edf8d7_100%)] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
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
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#b9ff63_0%,#88dd34_100%)] text-zinc-950 shadow-[0_10px_20px_rgba(137,217,54,0.28)]">
              <User2 className="h-8 w-8" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Blitze</p>
              <p className="mt-2 flex items-center gap-1 text-xl font-black text-foreground">
                {profile.points}
                <Zap className="h-4.5 w-4.5 fill-primary text-primary" />
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Level</p>
              <p className="mt-2 text-xl font-black text-foreground">{getLevelForPoints(profile.points).level}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Klasse</p>
              <p className="mt-2 truncate text-xl font-black text-foreground">{profile.class || "-"}</p>
            </div>
          </div>
        </Card>

        <div className="mb-4">
          <LevelCard points={profile.points} level={getLevelForPoints(profile.points)} />
        </div>

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
                  <p className="text-sm text-muted-foreground">Level, Streaks und Klassenlogik</p>
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
