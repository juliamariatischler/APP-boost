import { Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BOOST_POINT_RULES, WEEKLY_GOAL_DAYS, getWeeklyGoalProgress, getStreakIntensity, getStreakBonusForLength, STREAK_VISUALS, type StreakInfo } from "@/lib/gamification";
import { StreakFireVisual } from "./StreakFireVisual";

interface Props {
  streak: StreakInfo;
  weeklyCompletedDays: number;
}

export const StreakCard = ({ streak, weeklyCompletedDays }: Props) => {
  const weeklyProgress = getWeeklyGoalProgress(weeklyCompletedDays);
  const weeklyGoalMet = weeklyCompletedDays >= WEEKLY_GOAL_DAYS;
  const intensity = getStreakIntensity(streak.currentStreak);
  const visual = STREAK_VISUALS[intensity];
  const nextStreakBonus = getStreakBonusForLength(streak.currentStreak + 1);

  return (
    <Card className="p-4 bg-card shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Serie & Wochenziel</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {visual.label}
        </span>
      </div>

      {/* Streak with visual fire */}
      <div className="flex items-center gap-4 mb-4">
        <StreakFireVisual streak={streak.currentStreak} />
        <div>
          <span className="text-3xl font-black text-foreground">{streak.currentStreak}</span>
          <p className="text-xs text-muted-foreground">Tage Serie</p>
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
          <p className="text-xs text-center font-bold text-primary">
            ✅ Wochenziel erreicht: +{BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡
          </p>
        ) : (
          <p className="text-xs text-center text-muted-foreground">
            Noch <span className="font-bold text-primary">{WEEKLY_GOAL_DAYS - weeklyCompletedDays}</span> Tage diese Woche
          </p>
        )}
        {nextStreakBonus > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            Nächster Serienbonus morgen: <span className="font-bold text-primary">+{nextStreakBonus} ⚡</span>
          </p>
        )}
      </div>
    </Card>
  );
};
