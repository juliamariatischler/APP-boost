import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Zap } from "lucide-react";
import { toast } from "sonner";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";
import boostLogo from "@/assets/boost-logo.png";

type Exercise = {
  name: string;
  goal: number;
};

const exercises: Exercise[] = [
  { name: "Push-ups", goal: 20 },
  { name: "Squats", goal: 30 },
  { name: "Planks", goal: 60 },
  { name: "Sit-ups", goal: 25 },
  { name: "Jumping Jacks", goal: 40 },
];

const challengeData: Record<string, { title: string; image: string; description: string }> = {
  daily: {
    title: "Tägliche Challenge",
    image: dailyImg,
    description: "Absolviere deine tägliche Bewegungsaufgabe und bleib aktiv!",
  },
  weekly: {
    title: "Wochenaufgaben Challenge",
    image: weeklyImg,
    description: "Meistere die Herausforderungen dieser Woche gemeinsam mit deinen Mitschülern!",
  },
  friend: {
    title: "Friendquest Challenge",
    image: friendImg,
    description: "Fordere deine Freunde heraus und habt zusammen Spaß an der Bewegung!",
  },
  tryit: {
    title: "Try It Challenge",
    image: tryitImg,
    description: "Probiere etwas Neues aus und erweitere deine Bewegungsfähigkeiten!",
  },
};

const ChallengeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<Record<string, number>>({});

  const challenge = id ? challengeData[id] : null;

  if (!challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Challenge nicht gefunden</p>
      </div>
    );
  }

  const handleExerciseClick = (exerciseName: string) => {
    // Navigate to Jumping Jacks counter
    if (exerciseName === "Jumping Jacks") {
      navigate("/jumping-jacks-counter");
      return;
    }
    
    const currentResult = results[exerciseName] || 0;
    const exercise = exercises.find(e => e.name === exerciseName);
    
    if (!exercise) return;
    
    // Simulate recording exercise - increment by 1
    const newResult = currentResult + 1;
    setResults({ ...results, [exerciseName]: newResult });
    
    if (newResult >= exercise.goal) {
      toast.success(`🎉 ${exerciseName} Ziel erreicht!`);
    }
  };

  const isGoalReached = (exerciseName: string) => {
    const exercise = exercises.find(e => e.name === exerciseName);
    if (!exercise) return false;
    return (results[exerciseName] || 0) >= exercise.goal;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm p-4 mb-6">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          <img src={boostLogo} alt="BOOST Logo" className="h-12 w-auto" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 pb-8">
        <Card className="p-6 bg-card shadow-card">
          <h1 className="text-3xl font-bold mb-4 text-center text-foreground">
            {challenge.title}
          </h1>

          <div className="mb-6 rounded-lg overflow-hidden">
            <img
              src={challenge.image}
              alt={challenge.title}
              className="w-full h-auto"
            />
          </div>

          <p className="text-lg text-muted-foreground mb-8 text-center">
            {challenge.description}
          </p>

          {id === "daily" && (
            <div className="space-y-6">
              {/* Exercise Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {exercises.map((exercise) => (
                  <Button
                    key={exercise.name}
                    onClick={() => handleExerciseClick(exercise.name)}
                    className="h-20 text-sm font-medium"
                    variant={isGoalReached(exercise.name) ? "default" : "outline"}
                  >
                    {exercise.name}
                  </Button>
                ))}
              </div>

              {/* Results Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Übung</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead className="w-20">Ergebnis</TableHead>
                      <TableHead className="text-center">Erreicht</TableHead>
                      <TableHead className="w-16 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exercises.map((exercise) => {
                      const result = results[exercise.name] || 0;
                      const reached = isGoalReached(exercise.name);
                      
                      return (
                        <TableRow key={exercise.name}>
                          <TableCell className="font-medium">{exercise.name}</TableCell>
                          <TableCell>{exercise.goal}</TableCell>
                          <TableCell className="w-20">{result}</TableCell>
                          <TableCell className="text-center">
                            {reached ? "Ja" : "Nein"}
                          </TableCell>
                          <TableCell className="w-16 text-center">
                            {reached && <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500 mx-auto" />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ChallengeDetail;
