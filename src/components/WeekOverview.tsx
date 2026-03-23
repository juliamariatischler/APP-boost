import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { Zap } from "lucide-react";

interface DailyResult {
  date: string;
  push_ups: number;
  squats: number;
  planks: number;
  sit_ups: number;
  jumping_jacks: number;
}

const EXERCISE_GOALS = {
  jumping_jacks: 40,
  push_ups: 10,
  squats: 10,
  planks: 10,
  sit_ups: 25,
};

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

  const calculateDailyPoints = (day: DailyResult) => {
    let points = 0;
    if (day.jumping_jacks >= EXERCISE_GOALS.jumping_jacks) points++;
    if (day.push_ups >= EXERCISE_GOALS.push_ups) points++;
    if (day.squats >= EXERCISE_GOALS.squats) points++;
    if (day.planks >= EXERCISE_GOALS.planks) points++;
    if (day.sit_ups >= EXERCISE_GOALS.sit_ups) points++;
    return points;
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

  const totalWeeklyPoints = weeklyData.reduce((sum, day) => sum + calculateDailyPoints(day), 0);
  const daysOfWeek = getDaysOfWeek();

  if (loading) {
    return <Card className="p-6 bg-card shadow-card"><p className="text-center">Lädt...</p></Card>;
  }

  return (
    <Card className="p-6 bg-card shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Diese Woche</h2>
        <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
          <Zap className="h-5 w-5 text-primary fill-primary" />
          <span className="font-bold text-primary text-lg">{totalWeeklyPoints}</span>
          <span className="text-sm text-muted-foreground">/ 35</span>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {daysOfWeek.map((day) => {
          const data = getDataForDate(day);
          const points = data ? calculateDailyPoints(data) : 0;
          const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
          const isPast = day < new Date() && !isToday;
          
          return (
            <div
              key={day.toISOString()}
              className={`flex flex-col items-center p-3 rounded-lg border-2 ${
                isToday
                  ? "border-primary bg-primary/5"
                  : isPast && points === 0
                  ? "border-muted bg-muted/30"
                  : "border-border bg-card"
              }`}
            >
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
                  points > 0 ? "text-primary fill-primary" : "text-muted-foreground"
                }`} />
                <span className={`text-sm font-bold ${
                  points > 0 ? "text-primary" : "text-muted-foreground"
                }`}>
                  {points}
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
    </Card>
  );
};
