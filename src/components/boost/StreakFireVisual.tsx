import { motion } from "framer-motion";
import { getStreakIntensity, STREAK_VISUALS } from "@/lib/gamification";

interface Props {
  streak: number;
}

export const StreakFireVisual = ({ streak }: Props) => {
  const intensity = getStreakIntensity(streak);
  const visual = STREAK_VISUALS[intensity];

  if (intensity === "off") {
    return (
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <span className="text-2xl">💤</span>
      </div>
    );
  }

  return (
    <motion.div
      className="relative w-16 h-16 rounded-full flex items-center justify-center"
      style={{
        boxShadow: `0 0 ${12 * visual.scale}px ${visual.glowColor}, 0 0 ${24 * visual.scale}px ${visual.glowColor}`,
        background: `radial-gradient(circle, ${visual.glowColor}, transparent)`,
      }}
      animate={{
        scale: [visual.scale, visual.scale * 1.08, visual.scale],
      }}
      transition={{
        duration: intensity === "supernova" ? 0.6 : 1.2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <motion.span
        className="text-3xl"
        animate={{ rotate: intensity === "supernova" ? [0, 5, -5, 0] : [0, 2, -2, 0] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      >
        {visual.emoji}
      </motion.span>
      {(intensity === "inferno" || intensity === "supernova") && (
        <>
          <motion.span
            className="absolute -top-1 -right-1 text-xs"
            animate={{ opacity: [0.5, 1, 0.5], y: [-2, -6, -2] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ✨
          </motion.span>
          <motion.span
            className="absolute -bottom-1 -left-1 text-xs"
            animate={{ opacity: [0.3, 0.8, 0.3], y: [2, -4, 2] }}
            transition={{ duration: 1.3, repeat: Infinity, delay: 0.3 }}
          >
            ✨
          </motion.span>
        </>
      )}
    </motion.div>
  );
};
