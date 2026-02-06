import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Zap, LogOut, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import boostLogo from "@/assets/boost-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("username, school, class, points")
      .eq("id", session.user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    // Check if admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!roleData);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    navigate("/");
  };

  if (!profile) return null;

  return (
    <div className="bg-card shadow-sm p-4 mb-6">
      <div className="max-w-screen-xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
          {!isDashboard && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-1 px-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          )}
          <div>
            <p className="text-sm text-muted-foreground">{profile.school} - {profile.class}</p>
            <p className="font-bold text-foreground text-lg">{profile.username}</p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
            <Zap className="h-5 w-5 text-primary fill-primary" />
            <span className="font-bold text-primary">{profile.points}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
