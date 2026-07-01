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
import { isDemoEmail } from "@/lib/demo";
import {
  BOOST_POINT_RULES,
  DAILY_STEP_GOAL,
  DAILY_EXERCISE_GOALS,
  countCompletedDailyExercises,
  isDailyGoalComplete,
} from "@/lib/gamification";

const PROFILE_AGE_UNAVAILABLE_KEY = "boost:profiles_age_unavailable";

interface DailyChallengeContentProps {
  userId: string;
}

type Exercise = {
  name: string;
  goal: number;
  dbKey: string;
  icon: React.ReactNode;
  hint?: string;
};

const exercises: Exercise[] = [
  { name: "Push-ups", goal: DAILY_EXERCISE_GOALS.push_ups, dbKey: "push_ups", icon: <PushUpIcon className="h-6 w-6" /> },
  { name: "Squats", goal: DAILY_EXERCISE_GOALS.squats, dbKey: "squats", icon: <SquatIcon className="h-6 w-6" />, hint: "Seitlich zur Kamera stellen" },
  { name: "Planks", goal: DAILY_EXERCISE_GOALS.planks, dbKey: "planks", icon: <PlankIcon className="h-6 w-6" /> },
  { name: "Sit-ups", goal: DAILY_EXERCISE_GOALS.sit_ups, dbKey: "sit_ups", icon: <SitUpIcon className="h-6 w-6" /> },
  { name: "Jumping Jacks", goal: DAILY_EXERCISE_GOALS.jumping_jacks, dbKey: "jumping_jacks", icon: <JumpingJacksIcon className="h-6 w-6" /> },
];

export const DailyChallengeContent = ({ userId }: DailyChallengeContentProps) => {
  const [userAge, setUserAge] = useState<number | null>(null);
  const [steps, setSteps] = useState(0);
  const [stepsActive, setStepsActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const isHealthSupported = HealthService.isHealthPlatformSupported();
  // Schritte werden auf Android nicht mehr angezeigt (Feature komplett entfernt);
  // auf iOS bleiben sie als nicht-zählender Zusatz erhalten.
  const showSteps = !HealthService.isNativeAndroid();
  const healthSourceLabel = HealthService.getHealthSourceLabel();
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
    const { data: sessionData } = await supabase.auth.getSession();
    const currentEmail = sessionData.session?.user?.email;

    if (isDemoEmail(currentEmail)) {
      setUserAge(10);
      return;
    }

    if (sessionStorage.getItem(PROFILE_AGE_UNAVAILABLE_KEY) === "1") {
      setUserAge(null);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("age")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      const errorText = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
      if (
        error.code === "PGRST204" ||
        error.code === "PGRST205" ||
        errorText.includes("schema cache") ||
        errorText.includes("could not find the 'age' column")
      ) {
        sessionStorage.setItem(PROFILE_AGE_UNAVAILABLE_KEY, "1");
        setUserAge(null);
        return;
      }
    }

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
      const previouslyCompleted = countCompletedExercises(previousResults);
      const currentlyCompleted = countCompletedExercises(currentResults);
      const completionDelta = Math.max(0, currentlyCompleted - previouslyCompleted);
      const previouslyCompletedDailyGoal = isDailyGoalComplete({
        push_ups: previousResults["Push-ups"],
        squats: previousResults["Squats"],
        planks: previousResults["Planks"],
        sit_ups: previousResults["Sit-ups"],
        jumping_jacks: previousResults["Jumping Jacks"],
      });
      const currentlyCompletedDailyGoal = isDailyGoalComplete({
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

    // Schritte werden nur noch zur Anzeige gespeichert – sie zählen nicht zum
    // Tagesziel und geben keine Blitze mehr.
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
  };

  const activateStepTracking = async () => {
    if (!isHealthSupported) {
      toast.error("Schrittzähler nur in der mobilen App verfügbar", {
        description: HealthService.getHealthSetupDescription()
      });
      return;
    }

    const authorized = await HealthService.requestAuthorization();
    
    if (!authorized) {
      toast.error("Zugriff auf Gesundheitsdaten verweigert", {
        description: HealthService.getHealthPermissionHelp()
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
      if (realSteps === 0 && HealthService.isNativeAndroid()) {
        const description = await HealthService.getNoStepDataHelp();
        toast.info("Noch keine Schritte gefunden.", {
          description,
        });
      }
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
  // Schritte zählen nicht mehr zum Tagesziel – nur alle Übungen sind entscheidend.
  const isDailyChallengeComplete = allExercisesComplete;

  const stepsProgress = Math.min((steps / DAILY_STEP_GOAL) * 100, 100);
  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
      {/* Overall Status */}
      <Card className={`overflow-hidden rounded-[30px] border p-0 shadow-[0_18px_38px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.78)] ${
        isDailyChallengeComplete
          ? "border-primary/20 bg-[linear-gradient(135deg,#22c55e_0%,#14b8a6_54%,#38bdf8_100%)] text-white"
          : "border-black/5 bg-[linear-gradient(135deg,#22c55e_0%,#61d96b_48%,#f7f8e9_100%)] text-white"
      }`}>
        <div className="relative overflow-hidden p-5">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/18" />
          <div className="absolute right-10 bottom-0 h-20 w-20 rounded-full bg-yellow-300/25" />
          {isDailyChallengeComplete ? (
            <div className="relative flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/75">BOOST Tagesziel</p>
                <h2 className="mt-1 text-2xl font-black leading-tight text-white">Tageschallenge geschafft!</h2>
                <p className="mt-1 text-sm font-semibold leading-snug text-white/82">
                  Du hast dein Tagesziel erreicht und dir +{BOOST_POINT_RULES.dailyGoalCompleted} Blitze gesichert.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                <Circle className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/75">BOOST Tagesziel</p>
                <h2 className="mt-1 text-2xl font-black leading-tight text-white">Tageschallenge</h2>
                <p className="mt-1 text-sm font-semibold leading-snug text-white/82">
                  Schließe Übungen ab und knacke dein Tagesziel für +{BOOST_POINT_RULES.dailyGoalCompleted} Blitze.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* PART 1: Steps (nur iOS/Web – auf Android entfernt) */}
      {showSteps && (
      <Card className={`overflow-hidden rounded-[30px] border p-0 shadow-[0_18px_38px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.78)] ${
        isStepsComplete ? "border-primary/20 bg-[linear-gradient(180deg,#f0fff4_0%,#ffffff_72%)]" : "border-black/5 bg-white"
      }`}>
        <div className="p-4 sm:p-5">
          <div className="mb-5 flex items-start gap-3 sm:gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] text-base font-black shadow-[0_10px_20px_rgba(31,224,102,0.18)] ${
            isStepsComplete ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'
          }`}>
            {isStepsComplete ? <CheckCircle2 className="h-6 w-6" /> : "1"}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black leading-tight text-foreground">Challenge 1: Gehen</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">Mindestens {DAILY_STEP_GOAL.toLocaleString()} Schritte sammeln</p>
          </div>
          {isStepsComplete && <Zap className="h-6 w-6 text-yellow-500 fill-yellow-500" />}
        </div>

        {!stepsActive ? (
          <Button onClick={activateStepTracking} className="h-12 w-full rounded-full font-black" size="lg">
            <Play className="h-5 w-5 mr-2" />
            Schrittzähler starten
          </Button>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-[4rem_minmax(0,1fr)_2.75rem] items-center gap-3 rounded-[26px] bg-[linear-gradient(135deg,#f6f8f3_0%,#eefbf0_100%)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] sm:grid-cols-[5rem_minmax(0,1fr)_3rem] sm:gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-white text-primary shadow-[0_10px_24px_rgba(0,0,0,0.06)] sm:h-20 sm:w-20">
                <WalkingIcon className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>
              <div className="min-w-0">
                <div className={`text-4xl font-black leading-none sm:text-5xl ${isStepsComplete ? 'text-primary' : 'text-foreground'}`}>
                  {steps.toLocaleString()}
                </div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground sm:text-base">
                  von {DAILY_STEP_GOAL.toLocaleString()} Schritten
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchSteps}
                disabled={refreshing}
                className="h-11 w-11 rounded-full bg-white/80"
                aria-label="Schritte aktualisieren"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <Progress value={stepsProgress} className="h-3 rounded-full bg-neutral-200" />
            <div className="flex justify-between px-0.5 text-sm font-semibold text-muted-foreground">
              <span>{steps.toLocaleString()}</span>
              <span>{DAILY_STEP_GOAL.toLocaleString()}</span>
            </div>

            <div className="mt-2 rounded-[24px] border border-black/5 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-base font-black text-foreground">Warum Schritte wichtig sind</span>
                <Zap className={`h-5 w-5 ${isStepsComplete ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
              </div>
              <p className="text-base font-medium leading-relaxed text-muted-foreground">
                Die Schritte sind Teil deines Tagesziels. Sobald Schritte und alle Übungen geschafft sind, bekommst du
                einmalig +{BOOST_POINT_RULES.dailyGoalCompleted} Blitze.
              </p>
            </div>
          </div>
        )}
        </div>
      </Card>
      )}

      {/* PART 2: Exercises */}
      <Card className={`overflow-hidden rounded-[30px] border p-4 shadow-[0_18px_38px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.78)] sm:p-5 ${
        allExercisesComplete ? 'border-primary/20 bg-[linear-gradient(180deg,#f0fff4_0%,#ffffff_72%)]' : 'border-black/5 bg-white'
      }`}>
        <div className="mb-5 flex items-start gap-3 sm:gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] text-base font-black shadow-[0_10px_20px_rgba(31,224,102,0.18)] ${
            allExercisesComplete ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'
          }`}>
            {allExercisesComplete ? <CheckCircle2 className="h-6 w-6" /> : "2"}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black leading-tight text-foreground">Challenge {showSteps ? 2 : 1}: Übungen</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{completedExercises} von {exercises.length} abgeschlossen</p>

          </div>
          {allExercisesComplete && <Zap className="h-6 w-6 text-yellow-500 fill-yellow-500" />}
        </div>

        <div className="space-y-3">
          {exercises.map((exercise) => {
            const isComplete = isExerciseComplete(exercise.name);
            const current = results[exercise.name] || 0;
            
            return (
              <button
                key={exercise.name}
                onClick={() => handleExerciseClick(exercise.name)}
                className={`flex w-full items-center gap-3 rounded-[18px] border p-3 text-left transition-all ${
                  isComplete 
                    ? 'border-primary/25 bg-primary/10 shadow-[0_8px_20px_rgba(31,224,102,0.1)]' 
                    : 'border-black/5 bg-[#f7f8f3] hover:bg-[#eefbf0]'
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] ${isComplete ? 'bg-primary/20 text-primary' : 'bg-white text-foreground'}`}>
                  {exercise.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className={`font-black ${isComplete ? 'text-primary' : 'text-foreground'}`}>
                    {exercise.name}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {current} / {exercise.goal} {exercise.name === "Planks" ? "Sek." : ""}
                  </div>
                  {exercise.hint && (
                    <div className="text-xs text-muted-foreground/60 mt-0.5">{exercise.hint}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isComplete ? 'text-primary' : 'text-muted-foreground'}`}>
                    {exercise.goal}×
                  </span>
                  <Checkbox 
                    checked={isComplete} 
                    className={isComplete ? 'border-primary bg-primary text-primary-foreground' : ''}
                    disabled
                  />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-[30px] border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12)_0%,#ffffff_72%)] p-5 shadow-[0_14px_32px_rgba(0,0,0,0.06)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-primary/12 text-primary">
            <Zap className="h-5 w-5 fill-current" />
          </div>
          <div className="space-y-2">
            <h3 className="font-black text-foreground">
              Info zu Kraft und Knochen
              {userAge !== null ? ` für ${userAge}-Jährige` : ""}
            </h3>
            <p className="text-sm text-muted-foreground">{muscleTrainingInfo}</p>
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
        <div className="rounded-[18px] bg-muted/50 p-3 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            💡 Echte Schrittzählung funktioniert nur auf iOS (Apple Health) oder Android (Geräte-Schrittzähler).
          </p>
        </div>
      )}
    </div>
  );
};
