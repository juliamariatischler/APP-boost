import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";

interface Challenge {
  id: string;
  title: string;
  description: string;
  subInfo: string;
  image: string;
  progress: number;
}

const EXERCISE_GOALS = {
  jumping_jacks: 20,
  push_ups: 10,
  squats: 15,
  planks: 60,
  sit_ups: 15,
};

interface ChallengeScrollProps {
  userId: string;
}

export const ChallengeScroll = ({ userId }: ChallengeScrollProps) => {
  const navigate = useNavigate();
  const [dailyProgress, setDailyProgress] = useState(0);

  useEffect(() => {
    loadDailyProgress();
  }, [userId]);

  const loadDailyProgress = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("daily_results")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (error || !data) {
      setDailyProgress(0);
      return;
    }

    // Calculate progress: count how many exercises reached their goal
    const completedExercises = [
      data.jumping_jacks >= EXERCISE_GOALS.jumping_jacks,
      data.push_ups >= EXERCISE_GOALS.push_ups,
      data.squats >= EXERCISE_GOALS.squats,
      data.planks >= EXERCISE_GOALS.planks,
      data.sit_ups >= EXERCISE_GOALS.sit_ups,
    ].filter(Boolean).length;

    const progress = Math.round((completedExercises / 5) * 100);
    setDailyProgress(progress);
  };

  const challenges: Challenge[] = [
    { 
      id: "daily", 
      title: "Tägliche Challenge", 
      description: "Jeden Tag eine kurze Aufgabe – für Bewegung, Fokus oder Ausdauer.",
      subInfo: "⏱ 5–10 Minuten",
      image: dailyImg, 
      progress: dailyProgress 
    },
    { 
      id: "weekly", 
      title: "2-Wochenchallenge", 
      description: "Hol dir die Challenge eines Spitzensportlers – und wachse über dich hinaus.",
      subInfo: "🏆 14 Tage",
      image: weeklyImg, 
      progress: 40 
    },
    { 
      id: "friend", 
      title: "Friendquest", 
      description: "Gemeinsam stärker: Erfülle Challenges mit Freund:innen.",
      subInfo: "👥 Gemeinsam spielen",
      image: friendImg, 
      progress: 100 
    },
    { 
      id: "tryit", 
      title: "Try It", 
      description: "Probiere neue Sportarten & Aktivitäten aus – ganz unverbindlich.",
      subInfo: "📍 In deiner Nähe",
      image: tryitImg, 
      progress: 0 
    },
  ];

  return (
    <div className="mb-6">
      <div 
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
      >
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="flex-shrink-0 w-[280px] snap-start"
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
