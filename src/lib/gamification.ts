// === Level System (50 Stufen) ===
export interface LevelInfo {
  level: number;
  name: string;
  emoji: string;
  minPoints: number;
  maxPoints: number; // -1 = infinite
  color: string; // tailwind class token
  tier: string; // tier grouping for visual effects
}

// Generate 50 levels across 10 tiers
const TIERS = [
  { name: "Rookie", emoji: "🌱", color: "text-muted-foreground", tier: "rookie" },
  { name: "Starter", emoji: "⭐", color: "text-blue-500", tier: "starter" },
  { name: "Bronze", emoji: "🥉", color: "text-amber-700", tier: "bronze" },
  { name: "Silber", emoji: "🥈", color: "text-gray-400", tier: "silver" },
  { name: "Gold", emoji: "🥇", color: "text-yellow-500", tier: "gold" },
  { name: "Platin", emoji: "💎", color: "text-cyan-400", tier: "platinum" },
  { name: "Diamant", emoji: "👑", color: "text-purple-500", tier: "diamond" },
  { name: "Champion", emoji: "🏆", color: "text-orange-500", tier: "champion" },
  { name: "Legende", emoji: "🔥", color: "text-red-500", tier: "legend" },
  { name: "GOAT", emoji: "🐐", color: "text-primary", tier: "goat" },
];

function generateLevels(): LevelInfo[] {
  const levels: LevelInfo[] = [];
  // Points thresholds per tier (5 levels each)
  const tierThresholds = [
    0, 50, 150, 300, 500, 800, 1200, 1800, 2600, 4000
  ];
  
  for (let tierIdx = 0; tierIdx < 10; tierIdx++) {
    const t = TIERS[tierIdx];
    const tierStart = tierThresholds[tierIdx];
    const tierEnd = tierIdx < 9 ? tierThresholds[tierIdx + 1] : -1;
    const tierRange = tierEnd === -1 ? 2000 : tierEnd - tierStart;
    const stepSize = Math.floor(tierRange / 5);

    for (let sub = 0; sub < 5; sub++) {
      const lvl = tierIdx * 5 + sub + 1;
      const minPts = tierStart + sub * stepSize;
      const maxPts = lvl === 50 ? -1 : tierStart + (sub + 1) * stepSize - 1;
      const suffix = sub > 0 ? ` ${["I", "II", "III", "IV", "V"][sub]}` : "";
      
      levels.push({
        level: lvl,
        name: `${t.name}${suffix}`,
        emoji: t.emoji,
        minPoints: minPts,
        maxPoints: maxPts,
        color: t.color,
        tier: t.tier,
      });
    }
  }
  return levels;
}

export const LEVELS: LevelInfo[] = generateLevels();

export function getLevelForPoints(points: number): LevelInfo {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getLevelProgress(points: number): number {
  const level = getLevelForPoints(points);
  if (level.maxPoints === -1) return 100;
  const range = level.maxPoints - level.minPoints + 1;
  const progress = points - level.minPoints;
  return Math.min(Math.round((progress / range) * 100), 100);
}

export function getPointsToNextLevel(points: number): number {
  const level = getLevelForPoints(points);
  if (level.maxPoints === -1) return 0;
  return level.maxPoints - points + 1;
}

export function getNextLevel(points: number): LevelInfo | null {
  const current = getLevelForPoints(points);
  if (current.level >= 50) return null;
  return LEVELS[current.level]; // next index
}

// === Streak Visual Intensity ===
export type StreakIntensity = "off" | "spark" | "flame" | "fire" | "inferno" | "supernova";

export function getStreakIntensity(streak: number): StreakIntensity {
  if (streak === 0) return "off";
  if (streak <= 2) return "spark";
  if (streak <= 6) return "flame";
  if (streak <= 13) return "fire";
  if (streak <= 29) return "inferno";
  return "supernova";
}

export const STREAK_VISUALS: Record<StreakIntensity, { label: string; emoji: string; glowColor: string; scale: number }> = {
  off: { label: "Aus", emoji: "💤", glowColor: "transparent", scale: 1 },
  spark: { label: "Funke", emoji: "✨", glowColor: "hsla(38, 92%, 50%, 0.3)", scale: 1 },
  flame: { label: "Flamme", emoji: "🔥", glowColor: "hsla(25, 95%, 53%, 0.4)", scale: 1.1 },
  fire: { label: "Feuer", emoji: "🔥", glowColor: "hsla(15, 95%, 50%, 0.5)", scale: 1.2 },
  inferno: { label: "Inferno", emoji: "🌋", glowColor: "hsla(0, 90%, 50%, 0.6)", scale: 1.3 },
  supernova: { label: "Supernova", emoji: "💥", glowColor: "hsla(280, 90%, 60%, 0.7)", scale: 1.4 },
};

// === Rescue Day Logic ===
export const RESCUE_DAYS_PER_WEEK = 1;

export function canUseRescueDay(rescueDaysUsed: number): boolean {
  return rescueDaysUsed < RESCUE_DAYS_PER_WEEK;
}

// === Streak Calculation ===
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

export function calculateStreak(dates: string[]): StreakInfo {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const sorted = [...dates].sort((a, b) => b.localeCompare(a));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = formatDateLocal(today);
  const yesterdayStr = formatDateLocal(yesterday);

  let currentStreak = 0;
  if (sorted[0] === todayStr || sorted[0] === yesterdayStr) {
    currentStreak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let longestStreak = 1;
  let tempStreak = 1;
  const ascending = [...sorted].reverse();
  for (let i = 1; i < ascending.length; i++) {
    const prev = new Date(ascending[i - 1]);
    const curr = new Date(ascending[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) };
}

function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// === Weekly Goal ===
export const WEEKLY_GOAL_DAYS = 5;

export function getWeeklyGoalProgress(completedDays: number): number {
  return Math.min(Math.round((completedDays / WEEKLY_GOAL_DAYS) * 100), 100);
}

// === Class Participation ===
export const CLASS_PARTICIPATION_THRESHOLD = 70; // percent needed to keep class streak alive

// === Energy Rank ===
export type EnergyRank = "unter" | "gleich" | "über" | "weit_über";

export function getEnergyRank(userPoints: number, classAvg: number): EnergyRank {
  if (classAvg === 0) return "gleich";
  const ratio = userPoints / classAvg;
  if (ratio < 0.8) return "unter";
  if (ratio <= 1.2) return "gleich";
  if (ratio <= 1.8) return "über";
  return "weit_über";
}

export const ENERGY_RANK_INFO: Record<EnergyRank, { label: string; emoji: string; color: string }> = {
  unter: { label: "Unter Durchschnitt", emoji: "😤", color: "text-destructive" },
  gleich: { label: "Im Durchschnitt", emoji: "💪", color: "text-muted-foreground" },
  über: { label: "Über Durchschnitt", emoji: "⚡", color: "text-primary" },
  weit_über: { label: "Weit über Durchschnitt", emoji: "🚀", color: "text-yellow-500" },
};
