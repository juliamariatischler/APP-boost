import { Users, Shield, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CLASS_PARTICIPATION_THRESHOLD } from "@/lib/gamification";
import { motion } from "framer-motion";

interface ClassParticipation {
  total_students: number;
  active_students: number;
  participation_pct: number;
  streak_alive: boolean;
}

interface Props {
  participation: ClassParticipation;
  userClass: string;
  rescueDaysUsed: number;
}

export const ClassParticipationCard = ({ participation, userClass, rescueDaysUsed }: Props) => {
  const { total_students, active_students, participation_pct, streak_alive } = participation;
  const threshold = CLASS_PARTICIPATION_THRESHOLD;

  return (
    <Card className="p-4 bg-card shadow-lg overflow-hidden relative">
      {/* Glow effect when streak is alive */}
      {streak_alive && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            boxShadow: "inset 0 0 20px hsla(142, 76%, 50%, 0.15)",
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div className="flex items-center justify-between mb-3 relative">
        <span className="text-sm font-medium text-muted-foreground">Klassen-Blitz</span>
        {streak_alive ? (
          <Shield className="h-5 w-5 text-primary" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-destructive" />
        )}
      </div>

      <div className="flex items-center gap-3 mb-3 relative">
        <div className="bg-primary/10 px-3 py-1 rounded-full">
          <span className="font-bold text-primary">{userClass}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">
            {active_students}/{total_students}
          </span>
          <span className="text-xs text-muted-foreground">aktiv</span>
        </div>
      </div>

      <div className="space-y-2 relative">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Beteiligung heute</span>
          <span className={`font-bold ${streak_alive ? "text-primary" : "text-destructive"}`}>
            {participation_pct}%
          </span>
        </div>
        <div className="relative">
          <Progress value={participation_pct} className="h-3" />
          {/* Threshold marker */}
          <div
            className="absolute top-0 h-3 w-0.5 bg-foreground/50"
            style={{ left: `${threshold}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Ziel: {threshold}%</span>
          {streak_alive ? (
            <span className="font-bold text-primary">⚡ Blitz lebt!</span>
          ) : (
            <span className="font-bold text-destructive">💀 Blitz erloschen</span>
          )}
        </div>
      </div>

      {/* Rescue day info */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between relative">
        <span className="text-xs text-muted-foreground">🛡 Rettungstag</span>
        <span className="text-xs font-bold text-muted-foreground">
          {rescueDaysUsed === 0 ? (
            <span className="text-primary">1 verfügbar</span>
          ) : (
            <span className="text-destructive">Verbraucht</span>
          )}
        </span>
      </div>
    </Card>
  );
};
