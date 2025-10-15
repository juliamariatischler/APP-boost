import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChallengeVariants } from "./ChallengeVariants";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";

interface Challenge {
  id: string;
  title: string;
  image: string;
  progress: number;
}

const challenges: Challenge[] = [
  { id: "daily", title: "Tägliche Challenge", image: dailyImg, progress: 75 },
  { id: "weekly", title: "Wochenchallenge", image: weeklyImg, progress: 40 },
  { id: "friend", title: "Friendquest", image: friendImg, progress: 100 },
  { id: "tryit", title: "Try It", image: tryitImg, progress: 0 },
];

export const ChallengeScroll = () => {
  const navigate = useNavigate();
  const [showVariants, setShowVariants] = useState(true);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    setShowVariants(scrollLeft < 50);
  };

  return (
    <div className="mb-6">
      <div 
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        onScroll={handleScroll}
      >
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="flex-shrink-0 w-[280px] snap-start"
          >
            <h3 className="text-lg font-bold text-foreground mb-3">
              {challenge.title}
            </h3>
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
      
      {showVariants && <ChallengeVariants />}
    </div>
  );
};
