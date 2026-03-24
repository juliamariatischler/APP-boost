import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Circle, Zap, Play, RefreshCw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HealthService } from "@/services/healthService";
import { WalkingIcon, PushUpIcon, SquatIcon, PlankIcon, SitUpIcon, JumpingJacksIcon } from "@/components/ExerciseIcons";
import {
  BOOST_POINT_RULES,
  DAILY_STEP_GOAL,
  DAILY_EXERCISE_GOALS,
  countCompletedDailyExercises,
  isDailyGoalComplete,
} from "@/lib/gamification";

interface DailyChallengeContentProps {
  userId: string;
}

type Exercise = {
  name: string;
  goal: number;
  dbKey: string;
  icon: React.ReactNode;
};

const exercises: Exercise[] = [
  { name: "Push-ups", goal: DAILY_EXERCISE_GOALS.push_ups, dbKey: "push_ups", icon: <PushUpIcon className="h-6 w-6" /> },
  { name: "Squats", goal: DAILY_EXERCISE_GOALS.squats, dbKey: "squats", icon: <SquatIcon className="h-6 w-6" /> },
  { name: "Planks", goal: DAILY_EXERCISE_GOALS.planks, dbKey: "planks", icon: <PlankIcon className="h-6 w-6" /> },
  { name: "Sit-ups", goal: DAILY_EXERCISE_GOALS.sit_ups, dbKey: "sit_ups", icon: <SitUpIcon className="h-6 w-6" /> },
  { name: "Jumping Jacks", goal: DAILY_EXERCISE_GOALS.jumping_jacks, dbKey: "jumping_jacks", icon: <JumpingJacksIcon className="h-6 w-6" /> },
];

const TRAINING_FOCUS = [
  {
    title: "Ausdauer",
    accent: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    tips: [
      "3000 Schritte oder 2 aktive Blöcke mit Jumping Jacks sammeln.",
      "Zwischen den Übungen nur kurze Pausen machen.",
      "Ziel: in Bewegung bleiben statt auf maximale Intensität gehen.",
    ],
  },
  {
    title: "Kraft",
    accent: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    tips: [
      "10 Squats, 10 Push-ups und 10 Sekunden Plank sauber ausführen.",
      "Technik vor Tempo: ruhig und kontrolliert arbeiten.",
      "Wenn es leicht wird, einen zweiten kurzen Durchgang ergänzen.",
    ],
  },
  {
    title: "Koordination",
    accent: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    tips: [
      "Einbeinstände 20-30 Sek. pro Seite halten.",
      "10 Linien-Sprünge vor und zurück oder seitlich absolvieren.",
      "5 Würfe pro Hand gegen eine Wand oder zu einer Partnerperson.",
    ],
  },
] as const;

export const DailyChallengeContent = ({ userId }: DailyChallengeContentProps) => {
  const [userAge, setUserAge] = useState<number | null>(null);
  const [steps, setSteps] = useState(0);
  const [stepsActive, setStepsActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const isHealthSupported = HealthService.isHealthPlatformSupported();
  const healthSourceLabel = HealthService.getHealthSourceLabel();
  const trainingFocus = TRAINING_FOCUS[new Date().getDay() % TRAINING_FOCUS.length];
  const muscleTrainingInfo =
    userAge !== null && userAge <= 11
      ? "Muskeltraining ist auch für Kinder in Ordnung, wenn eine erwachsene Person auf saubere Technik achtet."
      : "Muskeltraining ist auch für Jugendliche sinnvoll, wenn sie gut angeleitet werden und kontrolliert trainieren.";
  const boneTrainingInfo =
    "Hüpfen, Springen, Volleyball, Basketball, Tennis, Parcours und Turnen stärken neben der Muskulatur auch die Knochen.";

  useEffect(() => {
    initializeDailyState();
  }, [userId]);

  const initializeDailyState = async () => {
    await loadProfileMeta();
    const currentResults = await loadTodayData();
    await checkLocalStorageResults(currentResults);
  };

  const loadProfileMeta = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("age")
      .eq("id", userId)
      .maybeSingle();

    setUserAge(data?.age ?? null);
  };

  const loadTodayData = async (): Promise<Record<string, number>> => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("daily_results")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    const initialResults = !error && data
      ? {
        "Push-ups": data.push_ups || 0,
        "Squats": data.squats || 0,
        "Planks": data.planks || 0,
        "Sit-ups": data.sit_ups || 0,
        "Jumping Jacks": data.jumping_jacks || 0,
      }
      : {
        "Push-ups": 0,
        "Squats": 0,
        "Planks": 0,
        "Sit-ups": 0,
        "Jumping Jacks": 0,
      };

    if (!error && data) {
      setSteps(data.steps || 0);
      setStepsActive(data.steps_tracking_active || false);
    }

    setResults(initialResults);
    setLoading(false);
    return initialResults;
  };

  const countCompletedExercises = (exerciseResults: Record<string, number>) => {
    return countCompletedDailyExercises({
      push_ups: exerciseResults["Push-ups"],
      squats: exerciseResults["Squats"],
      planks: exerciseResults["Planks"],
      sit_ups: exerciseResults["Sit-ups"],
      jumping_jacks: exerciseResults["Jumping Jacks"],
    });
  };

  const awardFlashes = async (delta: number) => {
    if (delta <= 0) return;
    const { error: incrementError } = await supabase.rpc("increment_points", {
      points_to_add: delta,
    });

    if (incrementError) {
      console.error("Error awarding flashes:", incrementError);
      toast.error("Ergebnis gespeichert, aber Blitze konnten nicht gutgeschrieben werden.");
      return;
    }

    window.dispatchEvent(new CustomEvent("points-updated", { detail: { delta } }));
    toast.success(`+${delta} ⚡ gutgeschrieben!`);
  };

  const checkLocalStorageResults = async (baseResults: Record<string, number>) => {
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
      const updated = {
        "Push-ups": (baseResults["Push-ups"] || 0) + (newResults["Push-ups"] || 0),
        "Squats": (baseResults["Squats"] || 0) + (newResults["Squats"] || 0),
        "Planks": (baseResults["Planks"] || 0) + (newResults["Planks"] || 0),
        "Sit-ups": (baseResults["Sit-ups"] || 0) + (newResults["Sit-ups"] || 0),
        "Jumping Jacks": (baseResults["Jumping Jacks"] || 0) + (newResults["Jumping Jacks"] || 0),
      };

      setResults(updated);
      await saveTodayResults(updated);
      return updated;
    }

    return baseResults;
  };

  const saveTodayResults = async (currentResults: Record<string, number>) => {
    const today = new Date().toISOString().split('T')[0];

    const { data: existingRow } = await supabase
      .from("daily_results")
      .select("push_ups, squats, planks, sit_ups, jumping_jacks, steps")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    const previousResults = {
      "Push-ups": existingRow?.push_ups || 0,
      "Squats": existingRow?.squats || 0,
      "Planks": existingRow?.planks || 0,
      "Sit-ups": existingRow?.sit_ups || 0,
      "Jumping Jacks": existingRow?.jumping_jacks || 0,
    };
    
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
      const previousSteps = Number(existingRow?.steps || 0);
      const previouslyCompleted = countCompletedExercises(previousResults);
      const currentlyCompleted = countCompletedExercises(currentResults);
      const completionDelta = Math.max(0, currentlyCompleted - previouslyCompleted);
      const previouslyCompletedDailyGoal = isDailyGoalComplete(previousSteps, {
        push_ups: previousResults["Push-ups"],
        squats: previousResults["Squats"],
        planks: previousResults["Planks"],
        sit_ups: previousResults["Sit-ups"],
        jumping_jacks: previousResults["Jumping Jacks"],
      });
      const currentlyCompletedDailyGoal = isDailyGoalComplete(steps, {
        push_ups: currentResults["Push-ups"],
        squats: currentResults["Squats"],
        planks: currentResults["Planks"],
        sit_ups: currentResults["Sit-ups"],
        jumping_jacks: currentResults["Jumping Jacks"],
      });

      if (completionDelta > 0) {
        await awardFlashes(completionDelta * BOOST_POINT_RULES.exerciseCompleted);
      }

      if (!previouslyCompletedDailyGoal && currentlyCompletedDailyGoal) {
        await awardFlashes(BOOST_POINT_RULES.dailyGoalCompleted);
      }

      toast.success("Ergebnisse gespeichert!");
    }
  };

  const saveSteps = async (realSteps: number) => {
    const today = new Date().toISOString().split("T")[0];
    const { data: existingRow } = await supabase
      .from("daily_results")
      .select("push_ups, squats, planks, sit_ups, jumping_jacks, steps")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    const previousResults = {
      push_ups: Number(existingRow?.push_ups || 0),
      squats: Number(existingRow?.squats || 0),
      planks: Number(existingRow?.planks || 0),
      sit_ups: Number(existingRow?.sit_ups || 0),
      jumping_jacks: Number(existingRow?.jumping_jacks || 0),
    };
    const previousSteps = Number(existingRow?.steps || 0);

    await supabase
      .from("daily_results")
      .upsert(
        {
          user_id: userId,
          date: today,
          steps: realSteps,
        },
        { onConflict: "user_id,date" }
      );

    const dailyGoalWasComplete = isDailyGoalComplete(previousSteps, previousResults);
    const dailyGoalIsComplete = isDailyGoalComplete(realSteps, previousResults);

    if (!dailyGoalWasComplete && dailyGoalIsComplete) {
      await awardFlashes(BOOST_POINT_RULES.dailyGoalCompleted);
    }
  };

  const activateStepTracking = async () => {
    if (!isHealthSupported) {
      toast.error("Schrittzähler nur in der mobilen App verfügbar", {
        description: "Bitte nutze ein iPhone (Apple Health) oder Android (Health Connect)."
      });
      return;
    }

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
      description: `Deine echten Schritte werden jetzt über ${healthSourceLabel} synchronisiert.`
    });
  };

  const fetchSteps = async () => {
    setRefreshing(true);
    try {
      const realSteps = await HealthService.getTodaySteps();
      setSteps(realSteps);
      await saveSteps(realSteps);
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

  const isStepsComplete = steps >= DAILY_STEP_GOAL;
  const completedExercises = exercises.filter(e => isExerciseComplete(e.name)).length;
  const allExercisesComplete = completedExercises === exercises.length;
  const isDailyChallengeComplete = isStepsComplete && allExercisesComplete;

  const stepsProgress = Math.min((steps / DAILY_STEP_GOAL) * 100, 100);
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
                <p className="text-sm text-green-600/80">
                  Du hast dein Tagesziel erreicht und dir +{BOOST_POINT_RULES.dailyGoalCompleted} Blitze gesichert.
                </p>
              </div>
            </>
          ) : (
            <>
              <Circle className="h-8 w-8 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-bold text-foreground">Tageschallenge</h2>
                <p className="text-sm text-muted-foreground">
                  Schließe Übungen ab und knacke dein Tagesziel für +{BOOST_POINT_RULES.dailyGoalCompleted} Blitze.
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className={`p-5 border ${trainingFocus.border} ${trainingFocus.bg}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">Heutiger Trainingsfokus</span>
          <span className={`text-sm font-bold ${trainingFocus.accent}`}>{trainingFocus.title}</span>
        </div>
        <div className="space-y-1.5 text-sm text-foreground">
          {trainingFocus.tips.map((tip) => (
            <p key={tip}>{tip}</p>
          ))}
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
            <h3 className="font-bold text-foreground">Challenge 1: Gehen</h3>
            <p className="text-xs text-muted-foreground">Mindestens {DAILY_STEP_GOAL.toLocaleString()} Schritte sammeln</p>
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
                  von {DAILY_STEP_GOAL.toLocaleString()} Schritten
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
              <span>{DAILY_STEP_GOAL.toLocaleString()}</span>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Warum Schritte wichtig sind</span>
                <Zap className={`h-5 w-5 ${isStepsComplete ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
              </div>
              <p className="text-sm text-muted-foreground">
                Die Schritte sind Teil deines Tagesziels. Sobald Schritte und alle Übungen geschafft sind, bekommst du
                einmalig +{BOOST_POINT_RULES.dailyGoalCompleted} Blitze.
              </p>
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
            <h3 className="font-bold text-foreground">Challenge 2: Übungen</h3>
            <p className="text-xs text-muted-foreground">{completedExercises} von {exercises.length} abgeschlossen</p>
            <p className="text-xs text-muted-foreground/80">
              Für jede abgeschlossene Übung gibt es +{BOOST_POINT_RULES.exerciseCompleted} Blitze.
            </p>
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

      <Card className="border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 text-primary" />
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">
              Info zu Kraft und Knochen
              {userAge !== null ? ` für ${userAge}-Jährige` : ""}
            </h3>
            <p className="text-sm text-muted-foreground">{muscleTrainingInfo}</p>
            <p className="text-sm text-muted-foreground">
              Wichtig ist eine mittlere bis hohe Anstrengung mit Übungen für Beine, Gesäß, Hüfte, Brust, Rücken,
              Bauch, Schultern und Arme.
            </p>
            <p className="text-sm text-muted-foreground">
              Auch Sportkurse mit Bändern, Körpergewicht oder einfachen Kraftformen können dazu beitragen.
            </p>
            <p className="text-sm text-muted-foreground">
              Unsere Übungen basieren auf internationalen Trainingsrichtlinien für Kinder und sind speziell auf
              Sicherheit, Einfachheit und Skalierbarkeit ausgelegt.
            </p>
            <p className="text-sm text-muted-foreground">{boneTrainingInfo}</p>
          </div>
        </div>
      </Card>

      {/* Native hint */}
      {!isHealthSupported && (
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">
            💡 Echte Schrittzählung funktioniert nur auf iOS (Apple Health) oder Android (Health Connect).
          </p>
        </div>
      )}
    </div>
  );
};
