import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame } from "lucide-react";
import { ChallengeScroll } from "@/components/ChallengeScroll";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { de } from "date-fns/locale";

const Dashboard = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>("");
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

    // Load profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("Error loading profile:", profileError);
      navigate("/");
      return;
    }

    if (profileData) {
      setUsername(profileData.username);
    } else {
      console.error("No profile found for user:", session.user.id);
      navigate("/");
      return;
    }

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

  if (!username) return null;

  return (
    <div className="min-h-screen bg-background pb-16">
      <TopHeader />

      {/* Main Content */}
      <div className="max-w-screen-xl mx-auto px-4">
        {/* Personal Greeting */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            Hi {username} 👋
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
