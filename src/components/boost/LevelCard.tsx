import { Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { BOOST_POINT_RULES, getLevelProgress, getPointsToNextLevel, getNextLevel, type LevelInfo } from "@/lib/gamification";
import { motion } from "framer-motion";

interface Props {
  points: number;
  level: LevelInfo;
  showPointSystem?: boolean;
}

export const LevelCard = ({ points, level, showPointSystem = false }: Props) => {
  const progress = getLevelProgress(points);
  const toNext = getPointsToNextLevel(points);
  const nextLevel = getNextLevel(points);
  const pointFacts = [
    { label: "1 Wdh. / 1 Sek.", value: `+${BOOST_POINT_RULES.repOrSecond}` },
    { label: "3 Tage in Folge", value: `+${BOOST_POINT_RULES.streak3DaysBonus}` },
    { label: "7 Tage in Folge", value: `+${BOOST_POINT_RULES.streak7DaysBonus}` },
    { label: "Wochen-Quest", value: `+${BOOST_POINT_RULES.weeklyChallengeCompleted}` },
  ];

  return (
    <div className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#b9ff63_0%,#88dd34_100%)] shadow-[0_22px_60px_rgba(137,217,54,0.28)]">
      <div className="p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
              Mein Level
            </span>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-800/60">
              {level.tier}-Level
            </p>
            <div className="mt-1 flex items-end gap-3">
              <span className="text-5xl font-black leading-none text-zinc-950">Lv.{level.level}</span>
              <div className="pb-1">
                <p className={`text-xl font-black ${level.color}`}>{level.name}</p>
                <p className="text-sm font-medium text-zinc-800/70">Dein aktueller Boost-Status</p>
              </div>
            </div>
          </div>
          <div className="rounded-[24px] bg-black/80 px-4 py-3 text-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Gesamt</p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-black">
              {points}
              <Zap className="h-5 w-5 fill-current" />
            </p>
          </div>
        </div>

        <motion.span
          className="inline-flex text-4xl"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {level.emoji}
        </motion.span>
      </div>

      <div className="rounded-t-[28px] bg-white/96 p-5">
        {nextLevel && (
          <div className="mb-5 rounded-[24px] bg-[#f7f7f1] p-4">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span>Fortschritt</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2.5 bg-white" />
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-muted-foreground">
                Nächstes Ziel: {nextLevel.emoji} Lv.{nextLevel.level} {nextLevel.name}
              </span>
              <span className="whitespace-nowrap font-black text-primary">{toNext} ⚡</span>
            </div>
          </div>
        )}
        {!nextLevel && (
          <p className="mb-5 text-center text-sm font-bold text-primary">Legendenstatus erreicht!</p>
        )}

        {showPointSystem && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">Punktesystem</h3>
              <span className="text-xs font-medium text-muted-foreground">So sammelst du Blitze</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {pointFacts.map((fact) => (
                <div key={fact.label} className="rounded-[20px] bg-[#f7f7f1] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{fact.label}</p>
                  <p className="mt-1 text-lg font-black text-foreground">{fact.value} ⚡</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
