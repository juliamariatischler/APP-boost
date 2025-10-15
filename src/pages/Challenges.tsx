import { useState } from "react";
import { ChallengeCard } from "@/components/ChallengeCard";
import { StatsHeader } from "@/components/StatsHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";

interface Challenge {
  id: number;
  title: string;
  description: string;
  points: number;
  completed: boolean;
}

const Challenges = () => {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<Challenge[]>([
    {
      id: 1,
      title: "Morgendliche Meditation",
      description: "Meditiere 10 Minuten am Morgen",
      points: 50,
      completed: false,
    },
    {
      id: 2,
      title: "Lernziel erreichen",
      description: "Schließe eine Lerneinheit ab",
      points: 100,
      completed: false,
    },
    {
      id: 3,
      title: "Gesunde Mahlzeit",
      description: "Bereite eine gesunde Mahlzeit zu",
      points: 75,
      completed: false,
    },
    {
      id: 4,
      title: "Bewegung",
      description: "30 Minuten Sport oder Spaziergang",
      points: 80,
      completed: false,
    },
  ]);

  const totalPoints = challenges
    .filter(c => c.completed)
    .reduce((sum, c) => sum + c.points, 0);
  
  const completedToday = challenges.filter(c => c.completed).length;
  const streak = 5; // This would come from a backend/state management

  const handleCompleteChallenge = (id: number) => {
    setChallenges(prev =>
      prev.map(challenge =>
        challenge.id === id
          ? { ...challenge, completed: true }
          : challenge
      )
    );
    
    const challenge = challenges.find(c => c.id === id);
    if (challenge) {
      toast.success(`🎉 ${challenge.title} abgeschlossen! +${challenge.points} Punkte`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/30 to-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          
          <img src={boostLogo} alt="Boost Logo" className="h-12 w-auto" />
          
          <div className="w-24" /> {/* Spacer for alignment */}
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Deine täglichen Challenges
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Schließe Challenges ab und sammle Punkte!
        </p>

        <StatsHeader
          totalPoints={totalPoints}
          streak={streak}
          completedToday={completedToday}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {challenges.map(challenge => (
            <ChallengeCard
              key={challenge.id}
              title={challenge.title}
              description={challenge.description}
              points={challenge.points}
              completed={challenge.completed}
              onComplete={() => handleCompleteChallenge(challenge.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Challenges;
