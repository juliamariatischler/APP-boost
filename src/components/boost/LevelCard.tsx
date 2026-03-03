import { Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getLevelProgress, getPointsToNextLevel, getNextLevel, type LevelInfo } from "@/lib/gamification";
import { motion } from "framer-motion";

interface Props {
  points: number;
  level: LevelInfo;
}

export const LevelCard = ({ points, level }: Props) => {
  const progress = getLevelProgress(points);
  const toNext = getPointsToNextLevel(points);
  const nextLevel = getNextLevel(points);

  return (
    <Card className="p-4 bg-card shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Mein Level</span>
        <motion.span
          className="text-2xl"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {level.emoji}
        </motion.span>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <span className="text-3xl font-black text-foreground">Lv.{level.level}</span>
        <div>
          <span className={`text-lg font-bold ${level.color}`}>{level.name}</span>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{level.tier}</p>
        </div>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
        <span className="text-2xl font-black text-foreground">{points}</span>
        <span className="text-sm text-muted-foreground mb-0.5">Blitze</span>
      </div>

      {nextLevel && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Lv.{level.level}</span>
            <span>{nextLevel.emoji} Lv.{nextLevel.level} {nextLevel.name}</span>
          </div>
          <Progress value={progress} className="h-2.5" />
          <p className="text-xs text-center text-muted-foreground">
            Noch <span className="font-bold text-primary">{toNext} ⚡</span> bis Lv.{nextLevel.level}
          </p>
        </div>
      )}
      {!nextLevel && (
        <p className="text-sm text-center font-bold text-primary">🐐 Maximales Level erreicht!</p>
      )}
    </Card>
  );
};
