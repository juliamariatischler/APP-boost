import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Circle, Zap, Play, RefreshCw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HealthService } from "@/services/healthService";
import { Capacitor } from "@capacitor/core";
import { WalkingIcon, PushUpIcon, SquatIcon, PlankIcon, SitUpIcon, JumpingJacksIcon } from "@/components/ExerciseIcons";

interface DailyChallengeContentProps {
  userId: string;
}

type Exercise = {
  name: string;
  goal: number;
  dbKey: string;
  icon: React.ReactNode;
};

const STEP_GOAL = 3000;

const exercises: Exercise[] = [
  { name: "Push-ups", goal: 20, dbKey: "push_ups", icon: <PushUpIcon className="h-6 w-6" /> },
  { name: "Squats", goal: 30, dbKey: "squats", icon: <SquatIcon className="h-6 w-6" /> },
  { name: "Planks", goal: 60, dbKey: "planks", icon: <PlankIcon className="h-6 w-6" /> },
  { name: "Sit-ups", goal: 25, dbKey: "sit_ups", icon: <SitUpIcon className="h-6 w-6" /> },
  { name: "Jumping Jacks", goal: 40, dbKey: "jumping_jacks", icon: <JumpingJacksIcon className="h-6 w-6" /> },
];

export const DailyChallengeContent = ({ userId }: DailyChallengeContentProps) => {
  const [steps, setSteps] = useState(0);
  const [stepsActive, setStepsActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    loadTodayData();
    checkLocalStorageResults();
  }, [userId]);

  const loadTodayData = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("daily_results")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (!error && data) {
      setSteps(data.steps || 0);
      setStepsActive(data.steps_tracking_active || false);
      setResults({
        "Push-ups": data.push_ups || 0,
        "Squats": data.squats || 0,
        "Planks": data.planks || 0,
        "Sit-ups": data.sit_ups || 0,
        "Jumping Jacks": data.jumping_jacks || 0,
      });
    }
    setLoading(false);
  };

  const checkLocalStorageResults = () => {
    const newResults: Record<string, number> = {};
    
    const MAX_VALUES: Record<string, number> = {
      'Jumping Jacks': 500,
      'Squats': 300,
      'Sit-ups': 300,
      'Push-ups': 200,
      'Planks': 600,
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

  const activateStepTracking = async () => {
    const authorized = await HealthService.requestAuthorization();
    
    if (!authorized) {
      toast.error("Zugriff auf Gesundheitsdaten verweigert", {
        description: "Bitte erlaube den Zugriff in den Einstellungen."
      });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    const { data: existing } = await supabase
      .from("daily_results")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("daily_results")
        .update({ 
          steps_tracking_active: true, 
          steps_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("daily_results")
        .insert({ 
          user_id: userId, 
          date: today, 
          steps: 0, 
          steps_tracking_active: true,
          steps_started_at: new Date().toISOString()
        });
    }

    setStepsActive(true);
    await fetchSteps();

    toast.success("Schrittzähler aktiviert! 🚶", {
      description: isNative 
        ? "Deine echten Schritte werden jetzt gezählt." 
        : "Im Browser werden Testdaten angezeigt."
    });
  };

  const fetchSteps = async () => {
    setRefreshing(true);
    try {
      const realSteps = await HealthService.getTodaySteps();
      setSteps(realSteps);
      
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from("daily_results")
        .upsert({
          user_id: userId,
          date: today,
          steps: realSteps,
        }, { onConflict: "user_id,date" });
    } catch (error) {
      console.error("Error fetching steps:", error);
      toast.error("Fehler beim Abrufen der Schritte");
    }
    setRefreshing(false);
  };

  const handleExerciseClick = (exerciseName: string) => {
    const routes: Record<string, string> = {
      "Jumping Jacks": '/jumping-jacks-counter.html',
      "Squats": '/squat-counter.html',
      "Sit-ups": '/situp-counter.html',
      "Push-ups": '/pushup-counter.html',
      "Planks": '/plank-timer.html',
    };
    
    if (routes[exerciseName]) {
      window.location.href = routes[exerciseName];
    }
  };

  const isExerciseComplete = (name: string) => {
    const exercise = exercises.find(e => e.name === name);
    if (!exercise) return false;
    return (results[name] || 0) >= exercise.goal;
  };

  const isStepsComplete = steps >= STEP_GOAL;
  const completedExercises = exercises.filter(e => isExerciseComplete(e.name)).length;
  const allExercisesComplete = completedExercises === exercises.length;
  const isDailyChallengeComplete = isStepsComplete && allExercisesComplete;

  const stepsProgress = Math.min((steps / STEP_GOAL) * 100, 100);

  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card className={`p-4 ${isDailyChallengeComplete ? 'bg-green-500/10 border-green-500' : 'bg-muted/30'}`}>
        <div className="flex items-center gap-3">
          {isDailyChallengeComplete ? (
            <>
              <Trophy className="h-8 w-8 text-green-600" />
              <div>
                <h2 className="text-lg font-bold text-green-600">🎉 Tageschallenge geschafft!</h2>
                <p className="text-sm text-green-600/80">Du hast beide Pflichtteile abgeschlossen.</p>
              </div>
            </>
          ) : (
            <>
              <Circle className="h-8 w-8 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-bold text-foreground">Tageschallenge</h2>
                <p className="text-sm text-muted-foreground">
                  Erledige beide Pflichtteile, um die Challenge abzuschließen.
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* PART 1: Steps */}
      <Card className={`p-5 ${isStepsComplete ? 'border-green-500 bg-green-500/5' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
            isStepsComplete ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
          }`}>
            {isStepsComplete ? <CheckCircle2 className="h-5 w-5" /> : "1"}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">Pflicht 1: Gehen</h3>
            <p className="text-xs text-muted-foreground">Mindestens {STEP_GOAL.toLocaleString()} Schritte sammeln</p>
          </div>
          {isStepsComplete && <Zap className="h-6 w-6 text-yellow-500 fill-yellow-500" />}
        </div>

        {!stepsActive ? (
          <Button onClick={activateStepTracking} className="w-full" size="lg">
            <Play className="h-5 w-5 mr-2" />
            Schrittzähler starten
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
              <WalkingIcon className={`h-12 w-12 ${isStepsComplete ? 'text-green-500' : 'text-primary'}`} />
              <div className="flex-1">
                <div className={`text-4xl font-bold ${isStepsComplete ? 'text-green-600' : 'text-foreground'}`}>
                  {steps.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  von {STEP_GOAL.toLocaleString()} Schritten
                  {!isNative && <span className="text-xs ml-1">(Testdaten)</span>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchSteps}
                disabled={refreshing}
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <Progress value={stepsProgress} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{steps.toLocaleString()}</span>
              <span>{STEP_GOAL.toLocaleString()}</span>
            </div>
          </div>
        )}
      </Card>

      {/* PART 2: Exercises */}
      <Card className={`p-5 ${allExercisesComplete ? 'border-green-500 bg-green-500/5' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
            allExercisesComplete ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
          }`}>
            {allExercisesComplete ? <CheckCircle2 className="h-5 w-5" /> : "2"}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">Pflicht 2: Übungen</h3>
            <p className="text-xs text-muted-foreground">{completedExercises} von {exercises.length} abgeschlossen</p>
          </div>
          {allExercisesComplete && <Zap className="h-6 w-6 text-yellow-500 fill-yellow-500" />}
        </div>

        <div className="space-y-2">
          {exercises.map((exercise) => {
            const isComplete = isExerciseComplete(exercise.name);
            const current = results[exercise.name] || 0;
            
            return (
              <button
                key={exercise.name}
                onClick={() => handleExerciseClick(exercise.name)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  isComplete 
                    ? 'bg-green-500/10 border border-green-500' 
                    : 'bg-muted/50 hover:bg-muted border border-transparent'
                }`}
              >
                <div className={`p-2 rounded-lg ${isComplete ? 'bg-green-500/20' : 'bg-background'}`}>
                  {exercise.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className={`font-medium ${isComplete ? 'text-green-600' : 'text-foreground'}`}>
                    {exercise.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {current} / {exercise.goal} {exercise.name === "Planks" ? "Sek." : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isComplete ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {exercise.goal}×
                  </span>
                  <Checkbox 
                    checked={isComplete} 
                    className={isComplete ? 'border-green-500 bg-green-500 text-white' : ''}
                    disabled
                  />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Native hint */}
      {!isNative && (
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">
            💡 Für echte Schrittzählung die App auf deinem Handy installieren.
          </p>
        </div>
      )}
    </div>
  );
};
