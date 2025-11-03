import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Settings, LogOut } from "lucide-react";
import boostLogo from "@/assets/boost-logo.png";
import { ChallengeScroll } from "@/components/ChallengeScroll";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Profile {
  username: string;
  school: string;
  class: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  const checkAuthAndLoadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("username, school, class")
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
    navigate("/auth");
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="bg-card shadow-sm p-4 mb-6">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{profile.school} - {profile.class}</p>
              <p className="font-bold text-foreground text-lg">{profile.username}</p>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
              <Zap className="h-5 w-5 text-primary fill-primary" />
              <span className="font-bold text-primary">125</span>
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

      {/* Main Content */}
      <div className="max-w-screen-xl mx-auto px-4">
        <h2 className="text-2xl font-bold mb-4 text-foreground">
          Deine Challenges
        </h2>
        
        <ChallengeScroll />
      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
