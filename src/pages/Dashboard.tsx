import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Settings, LogOut, Flame } from "lucide-react";
import boostLogo from "@/assets/boost-logo.png";
import { ChallengeScroll } from "@/components/ChallengeScroll";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { de } from "date-fns/locale";

interface Profile {
  username: string;
  school: string;
  class: string;
  points: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [weeklyCompleted, setWeeklyCompleted] = useState(0);
  const [weeklyTotal] = useState(28); // 4 challenges * 7 days

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  const checkAuthAndLoadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/");
      return;
    }

    setUserId(session.user.id);

    // Load profile with error handling
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("username, school, class, points")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("Error loading profile:", profileError);
      toast.error("Fehler beim Laden des Profils");
      navigate("/");
      return;
    }

    if (profileData) {
      setProfile(profileData);
    } else {
      console.error("No profile found for user:", session.user.id);
      toast.error("Kein Profil gefunden");
      navigate("/");
      return;
    }

    // Check if admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!roleData);

    // Load weekly progress
    const today = new Date();
    const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });
    
    const { data: weeklyData } = await supabase
      .from("daily_results")
      .select("*")
      .eq("user_id", session.user.id)
      .gte("date", format(weekStart, "yyyy-MM-dd"))
      .lte("date", format(weekEnd, "yyyy-MM-dd"));

    if (weeklyData) {
      // Count days with any activity as "completed challenges"
      const daysWithActivity = weeklyData.filter(day => 
        (day.jumping_jacks || 0) > 0 || 
        (day.push_ups || 0) > 0 || 
        (day.squats || 0) > 0 || 
        (day.planks || 0) > 0 || 
        (day.sit_ups || 0) > 0
      ).length;
      setWeeklyCompleted(daysWithActivity);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    navigate("/");
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

      {/* Main Content */}
      <div className="max-w-screen-xl mx-auto px-4">
        {/* Personal Greeting */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            Hi {profile.username} 👋
          </h2>
          <p className="text-sm text-muted-foreground">
            Bereit für deine nächste Challenge?
          </p>
        </div>

        {/* Weekly Progress */}
        <div className="bg-card rounded-lg p-4 mb-6 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Wochenfortschritt</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {weeklyCompleted} von {weeklyTotal} Challenges erledigt
            </span>
            <span className="text-xs font-bold text-primary">
              {Math.round((weeklyCompleted / weeklyTotal) * 100)}%
            </span>
          </div>
          <Progress value={(weeklyCompleted / weeklyTotal) * 100} className="h-2" />
        </div>

        <h2 className="text-lg font-bold mb-3 text-foreground">
          Deine Challenges
        </h2>
        
        {userId && <ChallengeScroll userId={userId} />}
      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
