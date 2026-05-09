import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Zap, LogOut, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import boostLogo from "@/assets/boost-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDemoAwarePoints, isDemoEmail } from "@/lib/demo";

const POINTS_DECAY_UNAVAILABLE_KEY = "boost:apply_daily_points_decay_unavailable";

interface Profile {
  username: string;
  school: string;
  class: string;
  points: number;
}

interface TopHeaderProps {
  backTo?: string;
  hideNav?: boolean;
}

export const TopHeader = ({ backTo = "/dashboard", hideNav = false }: TopHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const isDashboard = location.pathname === "/dashboard";

  useEffect(() => {
    loadProfile();
  }, [location.pathname]);

  useEffect(() => {
    const handlePointsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ delta?: number }>;
      const delta = Number(customEvent.detail?.delta || 0);
      if (!delta) return;

      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, points: prev.points + delta };
      });
    };

    window.addEventListener("points-updated", handlePointsUpdated);
    return () => {
      window.removeEventListener("points-updated", handlePointsUpdated);
    };
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setProfile(null);
      return;
    }

    const demoUser = isDemoEmail(session.user.email);

    if (!demoUser) {
      void loadDecayState();
    }

    const [{ data: profileData }, { data: roleData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, school, class, points")
        .eq("id", session.user.id)
        .single(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    if (profileData) {
      setProfile({
        ...profileData,
        points: getDemoAwarePoints(profileData.points, session.user.email),
      });
    }

    setIsAdmin(!!roleData);
  };

  const loadDecayState = async () => {
    if (sessionStorage.getItem(POINTS_DECAY_UNAVAILABLE_KEY) === "1") {
      return;
    }

    const { data: decayState, error: decayError } = await (supabase.rpc as any)("apply_daily_points_decay");
    if (decayError) {
      const errorText = `${decayError.message ?? ""} ${decayError.details ?? ""} ${decayError.hint ?? ""}`.toLowerCase();
      const isMissingInfra =
        decayError.code === "PGRST202" ||
        decayError.code === "PGRST205" ||
        decayError.code === "404" ||
        errorText.includes("schema cache") ||
        errorText.includes("could not find the function");

      if (!isMissingInfra) {
        console.error("Points decay error:", decayError);
      } else {
        sessionStorage.setItem(POINTS_DECAY_UNAVAILABLE_KEY, "1");
      }
      return;
    }

    const decayedPoints = Number(decayState?.decayed_points || 0);
    const shouldWarn = Boolean(decayState?.should_warn);
    const minutesUntilDecay = Number(decayState?.minutes_until_decay || 0);

    if (decayedPoints > 0) {
      toast.info(`${decayedPoints} ⚡ verfallen nach 36h ohne Aktivität.`);
    }

    if (shouldWarn) {
      const hoursUntilDecay = Math.max(1, Math.ceil(minutesUntilDecay / 60));
      toast.warning(`Achtung: Blitz-Verfall in ca. ${hoursUntilDecay}h`, {
        description: "Wenn du 36 Stunden nichts machst, verfällt 1 Blitz."
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    navigate("/");
  };

  if (!profile) {
    return (
      <div className="border-b border-black/5 bg-white/95 px-4 pb-3 shadow-[0_8px_24px_rgba(0,0,0,0.05)] backdrop-blur mb-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-28 rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-24 rounded-full" />
            <Skeleton className="h-11 w-20 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-black/5 bg-white/95 px-4 pb-3 shadow-[0_8px_24px_rgba(0,0,0,0.05)] backdrop-blur mb-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {!isDashboard && !hideNav && (
            <Button
              variant="outline"
              onClick={() => navigate(backTo)}
              className="h-10 shrink-0 rounded-full border-black/10 bg-white px-3 text-sm font-bold shadow-[0_8px_20px_rgba(0,0,0,0.04)] sm:h-11 sm:px-4 sm:text-base"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Zurück</span>
            </Button>
          )}

          <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:h-11 sm:gap-2 sm:px-4">
            <Zap className="h-[18px] w-[18px] text-primary fill-primary sm:h-5 sm:w-5" />
            <span className="text-base font-black text-primary sm:text-lg">{profile.points}</span>
            <span className="hidden text-xs font-bold text-primary/75 sm:inline">gesamt</span>
          </div>
        </div>
        {!hideNav && (
          <div className="flex items-center gap-1.5 shrink-0 sm:gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Settings className="h-4 w-4 mr-2" />
                Admin
              </Button>
            )}
            <img src={boostLogo} alt="BOOST Logo" className="h-9 w-auto sm:h-11" />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 rounded-full sm:h-10 sm:w-10">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
