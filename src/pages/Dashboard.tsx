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
import { LevelCard } from "@/components/boost/LevelCard";
import { getLevelForPoints } from "@/lib/gamification";
import { ClassLeaderboard } from "@/components/boost/ClassLeaderboard";
import { getDemoAwarePoints, isDemoEmail } from "@/lib/demo";

const Dashboard = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [points, setPoints] = useState(0);
  const [userSchool, setUserSchool] = useState("");
  const [userClass, setUserClass] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [weeklyCompleted, setWeeklyCompleted] = useState(0);
  const [weeklyTotal] = useState(28); // 4 challenges * 7 days

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  useEffect(() => {
    const handlePointsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ delta?: number }>;
      const delta = Number(customEvent.detail?.delta || 0);
      if (!delta || isDemoUser) return;
      setPoints((prev) => prev + delta);
    };

    window.addEventListener("points-updated", handlePointsUpdated);
    return () => {
      window.removeEventListener("points-updated", handlePointsUpdated);
    };
  }, [isDemoUser]);

  const checkAuthAndLoadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/");
      return;
    }

    setUserId(session.user.id);
    setIsDemoUser(isDemoEmail(session.user.email));

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    const metaAccountType = String(session.user.user_metadata?.account_type || "").toLowerCase();
    setIsTeacher(!!roleData || metaAccountType === "teacher");

    // Load profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("username, points, school, class")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("Error loading profile:", profileError);
      navigate("/");
      return;
    }

    if (profileData) {
      setUsername(profileData.username);
      setPoints(getDemoAwarePoints(profileData.points, session.user.email));
      setUserSchool(profileData.school || "");
      setUserClass(profileData.class || "");
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

        {/* Level + Blitze */}
        <div className="mb-6">
          <LevelCard points={points} level={getLevelForPoints(points)} />
        </div>

        {isTeacher && userSchool && userClass && (
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-3 text-foreground">Klassen-Leaderboard</h2>
            <ClassLeaderboard userClass={userClass} userSchool={userSchool} />
          </div>
        )}

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
