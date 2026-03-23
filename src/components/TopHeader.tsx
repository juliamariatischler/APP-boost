import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Zap, LogOut, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import boostLogo from "@/assets/boost-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDemoAwarePoints, isDemoEmail } from "@/lib/demo";

interface Profile {
  username: string;
  school: string;
  class: string;
  points: number;
}

export const TopHeader = () => {
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
    const { data: decayState, error: decayError } = await (supabase.rpc as any)("apply_daily_points_decay");
    if (decayError) {
      console.error("Points decay error:", decayError);
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
      <div className="bg-card shadow-sm px-4 py-3 mb-6">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-12 w-20 rounded-lg" />
            <Skeleton className="h-12 w-24 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card shadow-sm px-4 py-3 mb-6">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {!isDashboard && (
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="h-10 px-3 shrink-0"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Zurück
            </Button>
          )}

          <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg shrink-0">
            <Zap className="h-5 w-5 text-primary fill-primary" />
            <span className="font-bold text-primary">{profile.points}</span>
            <span className="text-xs font-medium text-primary/80">gesamt</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              <Settings className="h-4 w-4 mr-2" />
              Admin
            </Button>
          )}
          <img src={boostLogo} alt="BOOST Logo" className="h-12 w-auto" />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
