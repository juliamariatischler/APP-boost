import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";
import { format, subDays } from "date-fns";
import { isDemoEmail } from "@/lib/demo";

interface Challenge {
  id: string;
  title: string;
  description: string;
  subInfo: string;
  image: string;
  progress: number;
}

const EXERCISE_GOALS = {
  jumping_jacks: 40,
  push_ups: 10,
  squats: 10,
  planks: 10,
  sit_ups: 25,
};
const STEP_GOAL = 3000;

interface ChallengeScrollProps {
  userId: string;
}

export const ChallengeScroll = ({ userId }: ChallengeScrollProps) => {
  const navigate = useNavigate();
  const [dailyProgress, setDailyProgress] = useState(0);
  const [weeklyProgress, setWeeklyProgress] = useState(0);
  const [friendProgress, setFriendProgress] = useState(0);
  const [tryItProgress, setTryItProgress] = useState(0);

  useEffect(() => {
    loadChallengeProgress();
  }, [userId]);

  const loadChallengeProgress = async () => {
    const today = new Date().toISOString().split('T')[0];
    const fourteenDaysAgo = format(subDays(new Date(), 13), "yyyy-MM-dd");
    const { data: sessionData } = await supabase.auth.getSession();
    const demoUser = isDemoEmail(sessionData.session?.user?.email);

    const [
      todayResultRes,
      twoWeekResultsRes,
      friendInvitationsRes,
      tryItRegistrationsRes,
    ] = await Promise.all([
      supabase
        .from("daily_results")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("daily_results")
        .select("jumping_jacks, push_ups, squats, planks, sit_ups")
        .eq("user_id", userId)
        .gte("date", fourteenDaysAgo)
        .lte("date", today),
      supabase
        .from("challenge_invitations")
        .select("status")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`),
      supabase
        .from("trial_registrations")
        .select("id", { count: "exact" })
        .eq("user_id", userId)
        .eq("status", "registered"),
    ]);

    const todayData = todayResultRes.data;
    if (!todayResultRes.error && todayData) {
      const stepsProgress = Math.min((todayData.steps || 0) / STEP_GOAL, 1) * 50;
      const completedExercises = [
        (todayData.jumping_jacks || 0) >= EXERCISE_GOALS.jumping_jacks,
        (todayData.push_ups || 0) >= EXERCISE_GOALS.push_ups,
        (todayData.squats || 0) >= EXERCISE_GOALS.squats,
        (todayData.planks || 0) >= EXERCISE_GOALS.planks,
        (todayData.sit_ups || 0) >= EXERCISE_GOALS.sit_ups,
      ].filter(Boolean).length;
      const exercisesProgress = Math.min(completedExercises / 5, 1) * 50;
      const computedDailyProgress = Math.round(stepsProgress + exercisesProgress);
      setDailyProgress(demoUser ? Math.max(26, computedDailyProgress) : computedDailyProgress);
    } else {
      setDailyProgress(demoUser ? 26 : 0);
    }

    const twoWeekData = twoWeekResultsRes.data || [];
    if (!twoWeekResultsRes.error && twoWeekData.length > 0) {
      const activeDays = twoWeekData.filter((day) =>
        (day.jumping_jacks || 0) > 0 ||
        (day.push_ups || 0) > 0 ||
        (day.squats || 0) > 0 ||
        (day.planks || 0) > 0 ||
        (day.sit_ups || 0) > 0
      ).length;
      setWeeklyProgress(Math.round((activeDays / 14) * 100));
    } else {
      setWeeklyProgress(0);
    }

    const invitationData = friendInvitationsRes.data || [];
    if (!friendInvitationsRes.error && invitationData.length > 0) {
      const completedCount = invitationData.filter((inv) => inv.status === "completed").length;
      setFriendProgress(Math.round((completedCount / invitationData.length) * 100));
    } else {
      setFriendProgress(0);
    }

    if (!tryItRegistrationsRes.error) {
      // 3 Anmeldungen entsprechen 100% der Try-It-Challenge.
      const registeredCount = tryItRegistrationsRes.count || 0;
      setTryItProgress(Math.min(Math.round((registeredCount / 3) * 100), 100));
    } else {
      setTryItProgress(0);
    }
  };

  const challenges: Challenge[] = [
    {
      id: "daily",
      title: "Tägliche Challenge",
      description: "Jeden Tag ein kurzer Bewegungsimpuls mit Ausdauer, Kraft und ersten Koordinationsreizen.",
      subInfo: "⏱ 5–10 Minuten",
      image: dailyImg,
      progress: dailyProgress
    },
    {
      id: "weekly",
      title: "2-Wochenchallenge",
      description: "Eine Challenge, zwei Wege: Spitzensportler-Motivation oder Stempelkarte mit echten Offline-Erlebnissen.",
      subInfo: "🏆 14 Tage",
      image: weeklyImg,
      progress: weeklyProgress
    },
    { 
      id: "friend", 
      title: "Friendquest", 
      description: "Gemeinsam stärker: Erfülle Challenges mit Freund:innen.",
      subInfo: "👥 Gemeinsam spielen",
      image: friendImg, 
      progress: friendProgress 
    },
    {
      id: "tryit",
      title: "Try It",
      description: "Ein gemeinsames Try-It-System mit klarer Differenzierung nach Verein, Erlebnis und Belohnung.",
      subInfo: "📍 In deiner Nähe",
      image: tryitImg,
      progress: tryItProgress
    },
  ];

  return (
    <div className="mb-6">
      <div 
        className="flex flex-col gap-6 md:flex-row md:gap-4 md:overflow-x-auto md:pb-4 md:scrollbar-hide md:snap-x md:snap-mandatory"
      >
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="w-full md:flex-shrink-0 md:w-[280px] md:snap-start"
          >
            <h3 className="text-lg font-bold text-foreground mb-1">
              {challenge.title}
            </h3>
            <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
              {challenge.description}
            </p>
            <p className="text-xs text-muted-foreground/70 mb-2">
              {challenge.subInfo}
            </p>
            <Card
              className="bg-card shadow-card overflow-hidden cursor-pointer hover:shadow-lg transition-all relative"
              onClick={() => navigate(`/challenge/${challenge.id}`)}
            >
              <div className="relative aspect-[4/3]">
                <img
                  src={challenge.image}
                  alt={challenge.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-semibold">Fortschritt</span>
                    <span className="text-white text-sm font-bold">{challenge.progress}%</span>
                  </div>
                  <Progress value={challenge.progress} className="h-2" />
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
