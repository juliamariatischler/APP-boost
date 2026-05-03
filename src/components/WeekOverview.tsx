import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { de } from "date-fns/locale";
import { Star, Zap } from "lucide-react";
import { BOOST_POINT_RULES, DAILY_STEP_GOAL, DAILY_EXERCISE_GOALS, WEEKLY_GOAL_DAYS, calculateStreak, countCompletedDailyExercises, isDailyGoalComplete } from "@/lib/gamification";

interface DailyResult {
  date: string;
  push_ups: number;
  squats: number;
  planks: number;
  sit_ups: number;
  jumping_jacks: number;
  steps: number;
}

interface WeekOverviewProps {
  userId: string;
}

export const WeekOverview = ({ userId }: WeekOverviewProps) => {
  const [weeklyData, setWeeklyData] = useState<DailyResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeeklyData();
  }, [userId]);

  const loadWeeklyData = async () => {
    const today = new Date();
    const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });
    
    const { data, error } = await supabase
      .from("daily_results")
      .select("*")
      .eq("user_id", userId)
      .gte("date", format(weekStart, "yyyy-MM-dd"))
      .lte("date", format(weekEnd, "yyyy-MM-dd"))
      .order("date", { ascending: true });

    if (!error && data) {
      setWeeklyData(data);
    }
    setLoading(false);
  };

  const calculateDailyBlitze = (day: DailyResult) => {
    const completedExercises = countCompletedDailyExercises({
      jumping_jacks: day.jumping_jacks,
      push_ups: day.push_ups,
      squats: day.squats,
      planks: day.planks,
      sit_ups: day.sit_ups,
    });

    let blitze = completedExercises * BOOST_POINT_RULES.exerciseCompleted;
    if (
      isDailyGoalComplete(day.steps || 0, {
        jumping_jacks: day.jumping_jacks,
        push_ups: day.push_ups,
        squats: day.squats,
        planks: day.planks,
        sit_ups: day.sit_ups,
      })
    ) {
      blitze += BOOST_POINT_RULES.dailyGoalCompleted;
    }

    return blitze;
  };

  const hasAnyActivity = (day: DailyResult) => {
    return (
      (day.steps || 0) > 0 ||
      (day.jumping_jacks || 0) > 0 ||
      (day.push_ups || 0) > 0 ||
      (day.squats || 0) > 0 ||
      (day.planks || 0) > 0 ||
      (day.sit_ups || 0) > 0
    );
  };

  const addOneDayToDateString = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const nextDate = new Date(year, month - 1, day);
    nextDate.setDate(nextDate.getDate() + 1);
    return format(nextDate, "yyyy-MM-dd");
  };

  const getDaysOfWeek = () => {
    const today = new Date();
    const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  };

  const getDataForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return weeklyData.find(d => d.date === dateStr);
  };

  const totalWeeklyBlitze = weeklyData.reduce((sum, day) => sum + calculateDailyBlitze(day), 0);
  const daysOfWeek = getDaysOfWeek();
  const activeDates = weeklyData
    .filter(hasAnyActivity)
    .map((day) => day.date)
    .sort((a, b) => a.localeCompare(b));
  const currentStreak = calculateStreak(activeDates).currentStreak;
  const lastActiveDate = activeDates[activeDates.length - 1];
  const streakTargetDate = (() => {
    if (currentStreak !== WEEKLY_GOAL_DAYS - 1 || !lastActiveDate) return null;
    return addOneDayToDateString(lastActiveDate);
  })();

  if (loading) {
    return <Card className="p-6 bg-card shadow-card"><p className="text-center">Lädt...</p></Card>;
  }

  return (
    <Card className="p-6 bg-card shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Diese Woche</h2>
        <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
          <Zap className="h-5 w-5 text-primary fill-primary" />
          <span className="font-bold text-primary text-lg">{totalWeeklyBlitze}</span>
          <span className="text-sm text-muted-foreground">Blitze</span>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {daysOfWeek.map((day) => {
          const data = getDataForDate(day);
          const blitze = data ? calculateDailyBlitze(data) : 0;
          const hasActivity = data ? hasAnyActivity(data) : false;
          const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
          const isPast = day < new Date() && !isToday;
          const showStreakStar = format(day, "yyyy-MM-dd") === streakTargetDate && !hasActivity;
          
          return (
            <div
              key={day.toISOString()}
              className={`relative flex flex-col items-center p-3 rounded-lg border-2 ${
                isToday
                  ? "border-primary bg-primary/5"
                  : isPast && blitze === 0
                  ? "border-muted bg-muted/30"
                  : "border-border bg-card"
              }`}
            >
              {showStreakStar && (
                <div className="absolute top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Star className="h-3 w-3 fill-current" />
                </div>
              )}
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {format(day, "EEE", { locale: de })}
              </div>
              <div className={`text-lg font-bold mb-1 ${
                isToday ? "text-primary" : "text-foreground"
              }`}>
                {format(day, "d")}
              </div>
              <div className="flex items-center gap-1">
                <Zap className={`h-4 w-4 ${
                  blitze > 0 ? "text-primary fill-primary" : "text-muted-foreground"
                }`} />
                <span className={`text-sm font-bold ${
                  blitze > 0 ? "text-primary" : "text-muted-foreground"
                }`}>
                  {blitze}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-5 gap-2 text-xs">
        <div className="text-center">
          <div className="font-medium text-foreground mb-1">JJ</div>
          <div className="text-muted-foreground">
            {weeklyData.reduce((sum, d) => sum + d.jumping_jacks, 0)}
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-foreground mb-1">PU</div>
          <div className="text-muted-foreground">
            {weeklyData.reduce((sum, d) => sum + d.push_ups, 0)}
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-foreground mb-1">SQ</div>
          <div className="text-muted-foreground">
            {weeklyData.reduce((sum, d) => sum + d.squats, 0)}
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-foreground mb-1">PL</div>
          <div className="text-muted-foreground">
            {weeklyData.reduce((sum, d) => sum + d.planks, 0)}s
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-foreground mb-1">SU</div>
          <div className="text-muted-foreground">
            {weeklyData.reduce((sum, d) => sum + d.sit_ups, 0)}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        1 Wiederholung bzw. 1 Sekunde Plank = {BOOST_POINT_RULES.repOrSecond} ⚡. Tagesziel mit {DAILY_STEP_GOAL} Schritten und allen Übungen:
        +{BOOST_POINT_RULES.dailyGoalCompleted} ⚡ extra.
      </p>
    </Card>
  );
};
