import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";
import { BOOST_POINT_RULES } from "@/lib/gamification";

interface Challenge {
  id: string;
  title: string;
  description: string;
  subInfo: string;
  image: string;
}

export const ChallengeScroll = () => {
  const navigate = useNavigate();

  const challenges: Challenge[] = [
    {
      id: "daily",
      title: "Tägliche Challenge",
      description: `Jeden Tag Übungen abschließen, Fortschritt sehen und mit Tagesziel plus Übungen schnell Blitze sammeln.`,
      subInfo: "⏱ 5–10 Minuten",
      image: dailyImg,
    },
    {
      id: "weekly",
      title: "Wochenchallenge",
      description: `5 aktive Tage schaffen, sichtbar vorankommen und ${BOOST_POINT_RULES.weeklyChallengeCompleted} Blitze plus Badge holen.`,
      subInfo: "🏆 5 Tage Ziel",
      image: weeklyImg,
    },
    { 
      id: "friend", 
      title: "Friendquest", 
      description: "Gemeinsam stärker: Erfülle Challenges mit Freund:innen.",
      subInfo: "👥 Gemeinsam spielen",
      image: friendImg, 
    },
    {
      id: "tryit",
      title: "Try It",
      description: `Neue Sportarten, Trainings oder Vereine testen und pro Try-It ${BOOST_POINT_RULES.tryItCompleted} Blitze sammeln.`,
      subInfo: "📍 In deiner Nähe",
      image: tryitImg,
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
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
