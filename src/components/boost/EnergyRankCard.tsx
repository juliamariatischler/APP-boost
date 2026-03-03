import { Zap, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ENERGY_RANK_INFO, type EnergyRank } from "@/lib/gamification";
import { motion } from "framer-motion";

interface Props {
  userPoints: number;
  classAverage: number;
  energyRank: EnergyRank;
}

export const EnergyRankCard = ({ userPoints, classAverage, energyRank }: Props) => {
  const rankInfo = ENERGY_RANK_INFO[energyRank];
  const ratio = classAverage > 0 ? Math.min((userPoints / classAverage) * 100, 200) : 100;
  const displayRatio = Math.round(ratio);

  return (
    <Card className="p-4 bg-card shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Energie-Rang</span>
        <TrendingUp className="h-5 w-5 text-primary" />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <motion.span
          className="text-3xl"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {rankInfo.emoji}
        </motion.span>
        <div>
          <p className={`font-bold text-sm ${rankInfo.color}`}>{rankInfo.label}</p>
          <p className="text-xs text-muted-foreground">
            Du: <span className="font-bold text-foreground">{userPoints}</span> ⚡ · Klasse: <span className="font-bold text-foreground">{Math.round(classAverage)}</span> ⚡
          </p>
        </div>
      </div>

      {/* Visual comparison bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>vs. Klassendurchschnitt</span>
          <span className={`font-bold ${rankInfo.color}`}>{displayRatio}%</span>
        </div>
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          {/* Class average marker at 50% (100% = average) */}
          <div className="absolute top-0 h-full w-0.5 bg-foreground/30 z-10" style={{ left: "50%" }} />
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(ratio / 2, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          <span>Ø Klasse</span>
          <span>2x</span>
        </div>
      </div>
    </Card>
  );
};
