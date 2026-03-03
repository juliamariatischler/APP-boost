import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { LevelCard } from "@/components/boost/LevelCard";
import { StreakCard } from "@/components/boost/StreakCard";
import { BadgesCard } from "@/components/boost/BadgesCard";
import { ClassLeaderboard } from "@/components/boost/ClassLeaderboard";
import { ChallengeButtons } from "@/components/boost/ChallengeButtons";
import { useGamification } from "@/hooks/useGamification";
import { supabase } from "@/integrations/supabase/client";

const Boost = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userClass, setUserClass] = useState("");
  const [userSchool, setUserSchool] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  const gamification = useGamification(userId);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/"); return; }

      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("class, school")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserClass(profile.class);
        setUserSchool(profile.school);
      }
      setAuthLoading(false);
    };
    init();
  }, [navigate]);

  if (authLoading || gamification.loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="animate-pulse h-96 m-4 bg-muted rounded-lg" />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader />
      <div className="max-w-md mx-auto px-4 -mt-4 space-y-3">
        <LevelCard points={gamification.points} level={gamification.level} />
        <StreakCard streak={gamification.streak} weeklyCompletedDays={gamification.weeklyCompletedDays} />
        <BadgesCard allBadges={gamification.allBadges} earnedBadgeIds={gamification.earnedBadgeIds} />
        <ClassLeaderboard userClass={userClass} userSchool={userSchool} />
        <ChallengeButtons />
      </div>
      <BottomNav />
    </div>
  );
};

export default Boost;
