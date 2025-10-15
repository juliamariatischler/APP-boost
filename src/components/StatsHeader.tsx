import { Card } from "@/components/ui/card";
import { Trophy, Flame, Star } from "lucide-react";

interface StatsHeaderProps {
  totalPoints: number;
  streak: number;
  completedToday: number;
}

export const StatsHeader = ({ totalPoints, streak, completedToday }: StatsHeaderProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Gesamtpunkte</p>
            <p className="text-3xl font-bold text-primary">{totalPoints}</p>
          </div>
        </div>
      </Card>
      
      <Card className="p-6 bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-warning/10 rounded-full">
            <Flame className="h-8 w-8 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Streak</p>
            <p className="text-3xl font-bold text-warning">{streak} Tage</p>
          </div>
        </div>
      </Card>
      
      <Card className="p-6 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-success/10 rounded-full">
            <Star className="h-8 w-8 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Heute erledigt</p>
            <p className="text-3xl font-bold text-success">{completedToday}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
