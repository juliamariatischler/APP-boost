import { Flame, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WEEKLY_GOAL_DAYS, getWeeklyGoalProgress, type StreakInfo } from "@/lib/gamification";

interface Props {
  streak: StreakInfo;
  weeklyCompletedDays: number;
}

export const StreakCard = ({ streak, weeklyCompletedDays }: Props) => {
  const weeklyProgress = getWeeklyGoalProgress(weeklyCompletedDays);
  const weeklyGoalMet = weeklyCompletedDays >= WEEKLY_GOAL_DAYS;

  return (
    <Card className="p-4 bg-card shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Serie & Wochenziel</span>
        <Flame className="h-5 w-5 text-orange-500" />
      </div>

      {/* Streak */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
            <span className="text-2xl">🔥</span>
          </div>
          <div>
            <span className="text-2xl font-black text-foreground">{streak.currentStreak}</span>
            <p className="text-xs text-muted-foreground">Tage Serie</p>
          </div>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <span className="text-lg font-bold text-muted-foreground">{streak.longestStreak}</span>
          <p className="text-xs text-muted-foreground">Rekord</p>
        </div>
      </div>

      {/* Weekly goal */}
      <div className="pt-3 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Wochenziel</span>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {weeklyCompletedDays}/{WEEKLY_GOAL_DAYS} Tage
          </span>
        </div>
        <Progress value={weeklyProgress} className="h-2" />
        {weeklyGoalMet ? (
          <p className="text-xs text-center font-bold text-green-600">✅ Wochenziel erreicht!</p>
        ) : (
          <p className="text-xs text-center text-muted-foreground">
            Noch <span className="font-bold text-primary">{WEEKLY_GOAL_DAYS - weeklyCompletedDays}</span> Tage diese Woche
          </p>
        )}
      </div>
    </Card>
  );
};
