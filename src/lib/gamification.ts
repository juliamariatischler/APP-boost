// === BOOST Core Rules ===
export interface LevelInfo {
  level: number;
  name: string;
  emoji: string;
  minPoints: number;
  maxPoints: number; // -1 = infinite
  color: string; // tailwind class token
  tier: string; // tier grouping for visual effects
}

export const DAILY_STEP_GOAL = 3000;
export const DAILY_EXERCISE_GOALS = {
  push_ups: 10,
  squats: 10,
  planks: 10,
  sit_ups: 25,
  jumping_jacks: 40,
} as const;

export const BOOST_POINT_RULES = {
  repOrSecond: 1,
  exerciseCompleted: 1,
  dailyGoalCompleted: 20,
  weeklyChallengeCompleted: 20,
  tryItCompleted: 25,
  tryItProbetraining: 10,
  tryItNewSportDiscovered: 15,
  friendQuestCompleted: 12,
  friendQuestInvite: 8,
  friendQuestNewClassmate: 10,
  personalBestImproved: 15,
  firstExerciseTried: 10,
  accessibleVariantChosen: 10,
  coachingCompleted: 50,
  streak3DaysBonus: 5,
  streak7DaysBonus: 15,
} as const;

export const LEVELS: LevelInfo[] = [
  { level: 1, name: "Anfänger", emoji: "🌱", minPoints: 0, maxPoints: 24, color: "text-lime-600", tier: "Start" },
  { level: 2, name: "Aktivstarter", emoji: "⚡", minPoints: 25, maxPoints: 59, color: "text-sky-600", tier: "Aktiv" },
  { level: 3, name: "Booster", emoji: "🚀", minPoints: 60, maxPoints: 119, color: "text-indigo-600", tier: "Boost" },
  { level: 4, name: "Champion", emoji: "🏆", minPoints: 120, maxPoints: 199, color: "text-orange-600", tier: "Top" },
  { level: 5, name: "Legende", emoji: "👑", minPoints: 200, maxPoints: -1, color: "text-rose-600", tier: "Elite" },
];

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
  if (current.level >= LEVELS.length) return null;
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

// === Streak Calculation ===
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

export function getStreakBonusForLength(streak: number): number {
  if (streak >= 7) return BOOST_POINT_RULES.streak7DaysBonus;
  if (streak >= 3) return BOOST_POINT_RULES.streak3DaysBonus;
  return 0;
}

type DailyProgressValues = {
  steps?: number | null;
  steps_tracking_active?: boolean | null;
} & Partial<Record<keyof typeof DAILY_EXERCISE_GOALS, number | null>>;

export const STREAK_DAY_THRESHOLD_PERCENT = 80;

export function getDailyProgressPercent(day?: DailyProgressValues | null): number {
  if (!day) return 0;

  const steps = day.steps_tracking_active === false ? 0 : Number(day.steps || 0);
  const completedTaskCount =
    (steps >= DAILY_STEP_GOAL ? 1 : 0) +
    countCompletedDailyExercises({
      jumping_jacks: Number(day.jumping_jacks || 0),
      push_ups: Number(day.push_ups || 0),
      squats: Number(day.squats || 0),
      planks: Number(day.planks || 0),
      sit_ups: Number(day.sit_ups || 0),
    });
  const taskCount = Object.keys(DAILY_EXERCISE_GOALS).length + 1;

  return Math.min(100, Math.round((completedTaskCount / taskCount) * 100));
}

export function isStreakEligibleDay(day?: DailyProgressValues | null): boolean {
  return getDailyProgressPercent(day) >= STREAK_DAY_THRESHOLD_PERCENT;
}

export function calculateStreak(dates: string[]): StreakInfo {
  const uniqueDates = Array.from(new Set(dates.filter(Boolean)));
  if (uniqueDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const sorted = uniqueDates.sort((a, b) => b.localeCompare(a));

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
      const diffDays = getDateStringDiffDays(sorted[i - 1], sorted[i]);
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
    const diffDays = getDateStringDiffDays(ascending[i], ascending[i - 1]);
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

function getDateStringDiffDays(laterDateStr: string, earlierDateStr: string): number {
  const laterDate = parseLocalDate(laterDateStr);
  const earlierDate = parseLocalDate(earlierDateStr);
  return Math.round((laterDate.getTime() - earlierDate.getTime()) / (1000 * 60 * 60 * 24));
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// === Weekly Goal ===
export const WEEKLY_GOAL_DAYS = 5;

export function getWeeklyGoalProgress(completedDays: number): number {
  return Math.min(Math.round((completedDays / WEEKLY_GOAL_DAYS) * 100), 100);
}

export function countCompletedDailyExercises(values: Partial<Record<keyof typeof DAILY_EXERCISE_GOALS, number>>): number {
  return Object.entries(DAILY_EXERCISE_GOALS).filter(([key, goal]) => Number(values[key as keyof typeof DAILY_EXERCISE_GOALS] || 0) >= goal).length;
}

export function isDailyGoalComplete(
  steps: number,
  values: Partial<Record<keyof typeof DAILY_EXERCISE_GOALS, number>>
): boolean {
  return steps >= DAILY_STEP_GOAL && countCompletedDailyExercises(values) === Object.keys(DAILY_EXERCISE_GOALS).length;
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
