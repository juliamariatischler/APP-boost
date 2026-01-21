import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";
import boostLogo from "@/assets/boost-logo.png";
import TrialSessionsList from "@/components/TrialSessionsList";
import { PushUpIcon, SquatIcon, PlankIcon, SitUpIcon, JumpingJacksIcon } from "@/components/ExerciseIcons";

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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadResults();
  }, []);

  const checkAuthAndLoadResults = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserId(session.user.id);
    await loadTodayResults(session.user.id);
    checkLocalStorageResults();
  };

  const loadTodayResults = async (uid: string) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from("daily_results")
      .select("*")
      .eq("user_id", uid)
      .eq("date", today)
      .maybeSingle();

    if (data) {
      setResults({
        "Push-ups": data.push_ups || 0,
        "Squats": data.squats || 0,
        "Planks": data.planks || 0,
        "Sit-ups": data.sit_ups || 0,
        "Jumping Jacks": data.jumping_jacks || 0,
      });
    }
  };

  const checkLocalStorageResults = () => {
    const newResults: Record<string, number> = {};
    
    // Define maximum reasonable values for each exercise
    const MAX_VALUES: Record<string, number> = {
      'Jumping Jacks': 500,
      'Squats': 300,
      'Sit-ups': 300,
      'Push-ups': 200,
      'Planks': 600, // seconds
    };
    
    const storageKeys = [
      { key: 'jumpingjacks_result', name: 'Jumping Jacks' },
      { key: 'squats_result', name: 'Squats' },
      { key: 'situps_result', name: 'Sit-ups' },
      { key: 'pushups_result', name: 'Push-ups' },
      { key: 'planks_result', name: 'Planks' },
    ];
    
    for (const { key, name } of storageKeys) {
      const result = localStorage.getItem(key);
      
      if (result) {
        const value = parseInt(result, 10);
        
        // Validate: must be a number, positive, and within reasonable limits
        if (!isNaN(value) && value >= 0 && value <= MAX_VALUES[name]) {
          newResults[name] = value;
        } else {
          console.warn(`Invalid exercise result detected for ${name}: ${result}`);
          toast.error(`Ungültiges Ergebnis für ${name} erkannt und ignoriert`);
        }
        
        localStorage.removeItem(key);
      }
    }
    
    if (Object.keys(newResults).length > 0) {
      setResults(prev => {
        // WICHTIG: Addiere neue Ergebnisse zu den bestehenden, überschreibe sie nicht
        const updated = {
          "Push-ups": (prev["Push-ups"] || 0) + (newResults["Push-ups"] || 0),
          "Squats": (prev["Squats"] || 0) + (newResults["Squats"] || 0),
          "Planks": (prev["Planks"] || 0) + (newResults["Planks"] || 0),
          "Sit-ups": (prev["Sit-ups"] || 0) + (newResults["Sit-ups"] || 0),
          "Jumping Jacks": (prev["Jumping Jacks"] || 0) + (newResults["Jumping Jacks"] || 0),
        };
        saveTodayResults(updated);
        return updated;
      });
    }
  };

  const saveTodayResults = async (currentResults: Record<string, number>) => {
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from("daily_results")
      .upsert({
        user_id: userId,
        date: today,
        push_ups: currentResults["Push-ups"] || 0,
        squats: currentResults["Squats"] || 0,
        planks: currentResults["Planks"] || 0,
        sit_ups: currentResults["Sit-ups"] || 0,
        jumping_jacks: currentResults["Jumping Jacks"] || 0,
      }, {
        onConflict: "user_id,date"
      });

    if (error) {
      console.error("Error saving results:", error);
      toast.error("Fehler beim Speichern der Ergebnisse");
    } else {
      toast.success("Ergebnisse gespeichert!");
    }
  };

  const challenge = id ? challengeData[id] : null;

  if (!challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Challenge nicht gefunden</p>
      </div>
    );
  }

  const handleExerciseClick = (exerciseName: string) => {
    // Navigate to standalone HTML pages for AI-powered exercises
    if (exerciseName === "Jumping Jacks") {
      window.location.href = '/jumping-jacks-counter.html';
      return;
    }
    
    if (exerciseName === "Squats") {
      window.location.href = '/squat-counter.html';
      return;
    }
    
    if (exerciseName === "Sit-ups") {
      window.location.href = '/situp-counter.html';
      return;
    }
    
    if (exerciseName === "Push-ups") {
      window.location.href = '/pushup-counter.html';
      return;
    }
    
    if (exerciseName === "Planks") {
      window.location.href = '/plank-timer.html';
      return;
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
                {exercises.map((exercise) => {
                  const getExerciseIcon = (name: string) => {
                    switch (name) {
                      case "Push-ups": return <PushUpIcon className="h-20 w-20" />;
                      case "Squats": return <SquatIcon className="h-20 w-20" />;
                      case "Planks": return <PlankIcon className="h-20 w-20" />;
                      case "Sit-ups": return <SitUpIcon className="h-20 w-20" />;
                      case "Jumping Jacks": return <JumpingJacksIcon className="h-20 w-20" />;
                      default: return null;
                    }
                  };
                  
                  return (
                    <Button
                      key={exercise.name}
                      onClick={() => handleExerciseClick(exercise.name)}
                      className="h-20 text-sm font-medium flex flex-col gap-1"
                      variant={isGoalReached(exercise.name) ? "default" : "outline"}
                    >
                      {getExerciseIcon(exercise.name)}
                      {exercise.name}
                    </Button>
                  );
                })}
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

          {id === "tryit" && (
            <TrialSessionsList />
          )}
        </Card>
      </div>
    </div>
  );
};

export default ChallengeDetail;
