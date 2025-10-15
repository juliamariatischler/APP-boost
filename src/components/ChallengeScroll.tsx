import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";

interface Challenge {
  id: string;
  title: string;
  image: string;
}

const challenges: Challenge[] = [
  { id: "daily", title: "Tägliche Challenge", image: dailyImg },
  { id: "weekly", title: "Wochenaufgaben Challenge", image: weeklyImg },
  { id: "friend", title: "Friendquest Challenge", image: friendImg },
  { id: "tryit", title: "Try It Challenge", image: tryitImg },
];

export const ChallengeScroll = () => {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
        {challenges.map((challenge) => (
          <Card
            key={challenge.id}
            className="flex-shrink-0 w-[280px] bg-card shadow-card overflow-hidden cursor-pointer hover:shadow-lg transition-all snap-start"
            onClick={() => navigate(`/challenge/${challenge.id}`)}
          >
            <div className="p-4">
              <h3 className="text-lg font-bold text-foreground mb-3 text-center">
                {challenge.title}
              </h3>
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
                <img
                  src={challenge.image}
                  alt={challenge.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
