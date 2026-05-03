import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WalkingIcon } from "@/components/ExerciseIcons";
import { Zap, Play, CheckCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HealthService } from "@/services/healthService";

interface StepCounterProps {
  userId: string;
  onPointsEarned?: (points: number) => void;
}

const STEP_REWARDS = [
  { steps: 3000, flashes: 1 },
  { steps: 4000, flashes: 2 },
  { steps: 5000, flashes: 3 },
];

export const StepCounter = ({ userId, onPointsEarned }: StepCounterProps) => {
  const [steps, setSteps] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [earnedFlashes, setEarnedFlashes] = useState(0);
  const [lastAwardedFlashes, setLastAwardedFlashes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isHealthSupported = HealthService.isHealthPlatformSupported();
  const healthSourceLabel = HealthService.getHealthSourceLabel();

  useEffect(() => {
    loadTodaySteps();
  }, [userId]);

  // Auto-refresh steps every 30 seconds when active
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      fetchAndUpdateSteps();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isActive, userId]);

  const loadTodaySteps = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("daily_results")
      .select("steps, steps_tracking_active")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (!error && data) {
      setSteps(data.steps || 0);
      setIsActive(data.steps_tracking_active || false);
      const earned = calculateEarnedFlashes(data.steps || 0);
      setEarnedFlashes(earned);
      setLastAwardedFlashes(earned); // Don't re-award on page load
    }
    setLoading(false);
  };

  const calculateEarnedFlashes = (currentSteps: number): number => {
    let earned = 0;
    for (const reward of STEP_REWARDS) {
      if (currentSteps >= reward.steps) {
        earned = reward.flashes;
      }
    }
    return earned;
  };

  const saveSteps = async (newSteps: number) => {
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
        .update({ steps: newSteps, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("daily_results")
        .insert({ user_id: userId, date: today, steps: newSteps, steps_tracking_active: true });
    }
  };

  const checkAndAwardRewards = useCallback(async (currentSteps: number) => {
    const newFlashes = calculateEarnedFlashes(currentSteps);
    setEarnedFlashes(newFlashes);

    if (newFlashes > lastAwardedFlashes) {
      const pointsToAdd = newFlashes - lastAwardedFlashes;
      setLastAwardedFlashes(newFlashes);
      
      // Award points
      await (supabase.rpc as any)('increment_points', {
        points_to_add: pointsToAdd
      });

      toast.success(`🎉 ${pointsToAdd} Flash${pointsToAdd > 1 ? 'es' : ''} verdient!`, {
        description: `Du hast ${currentSteps.toLocaleString()} Schritte erreicht!`
      });

      onPointsEarned?.(pointsToAdd);
    }
  }, [lastAwardedFlashes, userId, onPointsEarned]);

  const fetchAndUpdateSteps = async () => {
    setRefreshing(true);
    try {
      const realSteps = await HealthService.getTodaySteps();
      setSteps(realSteps);
      await saveSteps(realSteps);
      await checkAndAwardRewards(realSteps);
    } catch (error) {
      console.error("Error fetching steps:", error);
      toast.error("Fehler beim Abrufen der Schritte");
    }
    setRefreshing(false);
  };

  const activateTracking = async () => {
    if (!isHealthSupported) {
      toast.error("Schrittzähler nur in der mobilen App verfügbar", {
        description: "Bitte nutze ein iPhone (Apple Health) oder Android (Health Connect)."
      });
      return;
    }

    // Request health authorization first
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

    setIsActive(true);
    
    // Fetch real steps immediately
    await fetchAndUpdateSteps();

    toast.success("Schrittzähler aktiviert! 🚶", {
      description: `Deine echten Schritte werden jetzt über ${healthSourceLabel} synchronisiert.`
    });
  };

  const getNextReward = () => {
    for (const reward of STEP_REWARDS) {
      if (steps < reward.steps) {
        return reward;
      }
    }
    return null;
  };

  const getProgressToNextReward = () => {
    const nextReward = getNextReward();
    if (!nextReward) return 100;
    
    const previousThreshold = STEP_REWARDS.find((r, i) => 
      STEP_REWARDS[i + 1]?.steps === nextReward.steps
    )?.steps || 0;
    
    const progress = ((steps - previousThreshold) / (nextReward.steps - previousThreshold)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  if (loading) {
    return (
      <Card className="p-4 bg-card shadow-card">
        <div className="animate-pulse h-32 bg-muted rounded" />
      </Card>
    );
  }

  const nextReward = getNextReward();
  const stepsToNext = nextReward ? nextReward.steps - steps : 0;

  return (
    <Card className="p-4 bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-full transition-all ${
          isActive 
            ? "bg-primary/20 text-primary animate-pulse" 
            : "bg-muted text-muted-foreground"
        }`}>
          <WalkingIcon className="h-8 w-8" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-foreground">Schrittzähler</h3>
          <p className="text-xs text-muted-foreground">
            {isActive 
              ? `Aktiv – synchronisiert mit ${healthSourceLabel}`
              : "Tippe zum Starten"}
          </p>
        </div>
        {!isActive ? (
          <Button 
            onClick={activateTracking}
            className="bg-primary hover:bg-primary/90"
          >
            <Play className="h-4 w-4 mr-2" />
            Starten
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAndUpdateSteps}
              disabled={refreshing}
              className="p-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1.5">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Aktiv</span>
            </div>
          </div>
        )}
      </div>

      {/* Step Count Display */}
      <div className="text-center py-4 bg-muted/30 rounded-lg mb-4">
        <div className="text-4xl font-bold text-foreground mb-1">
          {steps.toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">
          Schritte heute
        </div>
      </div>

      {/* Earned Flashes */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">Verdiente Flashes</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((flash) => (
            <Zap 
              key={flash}
              className={`h-5 w-5 transition-all ${
                flash <= earnedFlashes 
                  ? "text-primary fill-primary" 
                  : "text-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Progress to Next Reward */}
      {nextReward && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Noch {stepsToNext.toLocaleString()} Schritte bis zum nächsten Flash ⚡
            </span>
            <span className="font-medium text-primary">
              {nextReward.flashes} {nextReward.flashes === 1 ? 'Flash' : 'Flashes'}
            </span>
          </div>
          <Progress value={getProgressToNextReward()} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{steps.toLocaleString()}</span>
            <span>{nextReward.steps.toLocaleString()}</span>
          </div>
        </div>
      )}

      {!nextReward && earnedFlashes === 3 && (
        <div className="text-center py-2 bg-primary/10 rounded-lg">
          <span className="text-sm font-medium text-primary">
            🎉 Alle Belohnungen erreicht! Super gemacht!
          </span>
        </div>
      )}

      {/* Reward Tiers */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Belohnungsstufen:</p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {STEP_REWARDS.map((reward) => (
            <div 
              key={reward.steps}
              className={`p-2 rounded-lg ${
                steps >= reward.steps 
                  ? "bg-primary/20 text-primary" 
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <div className="font-bold">{reward.steps.toLocaleString()}</div>
              <div className="flex items-center justify-center gap-0.5">
                {Array.from({ length: reward.flashes }).map((_, i) => (
                  <Zap key={i} className="h-3 w-3" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Native hint */}
      {!isHealthSupported && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            💡 Echte Schrittzählung funktioniert nur auf iOS (Apple Health) oder Android (Health Connect).
          </p>
        </div>
      )}
    </Card>
  );
};
