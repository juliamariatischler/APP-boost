// === Level System (10 Stufen) ===
export interface LevelInfo {
  level: number;
  name: string;
  emoji: string;
  minPoints: number;
  maxPoints: number; // -1 = infinite
  color: string; // tailwind class token
}

export const LEVELS: LevelInfo[] = [
  { level: 1, name: "Rookie", emoji: "🌱", minPoints: 0, maxPoints: 49, color: "text-muted-foreground" },
  { level: 2, name: "Starter", emoji: "⭐", minPoints: 50, maxPoints: 149, color: "text-blue-500" },
  { level: 3, name: "Bronze", emoji: "🥉", minPoints: 150, maxPoints: 299, color: "text-amber-700" },
  { level: 4, name: "Silber", emoji: "🥈", minPoints: 300, maxPoints: 499, color: "text-gray-400" },
  { level: 5, name: "Gold", emoji: "🥇", minPoints: 500, maxPoints: 799, color: "text-yellow-500" },
  { level: 6, name: "Platin", emoji: "💎", minPoints: 800, maxPoints: 1199, color: "text-cyan-400" },
  { level: 7, name: "Diamant", emoji: "👑", minPoints: 1200, maxPoints: 1799, color: "text-purple-500" },
  { level: 8, name: "Champion", emoji: "🏆", minPoints: 1800, maxPoints: 2599, color: "text-orange-500" },
  { level: 9, name: "Legende", emoji: "🔥", minPoints: 2600, maxPoints: 3999, color: "text-red-500" },
  { level: 10, name: "GOAT", emoji: "🐐", minPoints: 4000, maxPoints: -1, color: "text-primary" },
];

export function getLevelForPoints(points: number): LevelInfo {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getLevelProgress(points: number): number {
  const level = getLevelForPoints(points);
  if (level.maxPoints === -1) return 100; // Max level
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
  if (current.level >= 10) return null;
  return LEVELS[current.level]; // next index
}

// === Streak Calculation ===
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

export function calculateStreak(dates: string[]): StreakInfo {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Sort dates descending
  const sorted = [...dates].sort((a, b) => b.localeCompare(a));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = formatDateLocal(today);
  const yesterdayStr = formatDateLocal(yesterday);

  // Current streak: must include today or yesterday
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

  // Longest streak
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
export const WEEKLY_GOAL_DAYS = 5; // 5 out of 7 days

export function getWeeklyGoalProgress(completedDays: number): number {
  return Math.min(Math.round((completedDays / WEEKLY_GOAL_DAYS) * 100), 100);
}
