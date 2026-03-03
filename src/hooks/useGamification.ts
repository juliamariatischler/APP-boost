import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLevelForPoints, calculateStreak, type LevelInfo, type StreakInfo } from "@/lib/gamification";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
}

interface UserBadge {
  badge_id: string;
  earned_at: string;
}

export interface GamificationData {
  points: number;
  level: LevelInfo;
  streak: StreakInfo;
  weeklyCompletedDays: number;
  allBadges: Badge[];
  earnedBadgeIds: string[];
  totalCompletedDays: number;
  loading: boolean;
}

export function useGamification(userId: string | null): GamificationData {
  const [data, setData] = useState<GamificationData>({
    points: 0,
    level: getLevelForPoints(0),
    streak: { currentStreak: 0, longestStreak: 0 },
    weeklyCompletedDays: 0,
    allBadges: [],
    earnedBadgeIds: [],
    totalCompletedDays: 0,
    loading: true,
  });

  useEffect(() => {
    if (!userId) return;
    loadGamificationData(userId);
  }, [userId]);

  const isCompletedDay = (day: any): boolean => {
    return (
      (day.steps || 0) >= 3000 &&
      (day.jumping_jacks || 0) >= 20 &&
      (day.push_ups || 0) >= 20 &&
      (day.squats || 0) >= 20 &&
      (day.planks || 0) >= 30 &&
      (day.sit_ups || 0) >= 20
    );
  };

  const loadGamificationData = async (uid: string) => {
    try {
      const [profileRes, allResultsRes, badgesRes, userBadgesRes] = await Promise.all([
        supabase.from("profiles").select("points").eq("id", uid).single(),
        supabase.from("daily_results").select("*").eq("user_id", uid).order("date", { ascending: false }),
        supabase.from("badges").select("*"),
        supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", uid),
      ]);

      const points = profileRes.data?.points || 0;
      const allResults = allResultsRes.data || [];
      const allBadges = (badgesRes.data || []) as Badge[];
      const userBadges = (userBadgesRes.data || []) as UserBadge[];

      // Completed days for streak
      const completedDates = allResults
        .filter(isCompletedDay)
        .map((r) => r.date);

      const streak = calculateStreak(completedDates);
      const totalCompletedDays = completedDates.length;

      // Weekly
      const today = new Date();
      const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");

      const weeklyCompletedDays = allResults
        .filter((r) => r.date >= weekStartStr && r.date <= weekEndStr && isCompletedDay(r))
        .length;

      setData({
        points,
        level: getLevelForPoints(points),
        streak,
        weeklyCompletedDays,
        allBadges,
        earnedBadgeIds: userBadges.map((ub) => ub.badge_id),
        totalCompletedDays,
        loading: false,
      });

      // Auto-award badges
      await checkAndAwardBadges(uid, allBadges, userBadges, points, streak, totalCompletedDays);
    } catch (err) {
      console.error("Gamification load error:", err);
      setData((prev) => ({ ...prev, loading: false }));
    }
  };

  const checkAndAwardBadges = async (
    uid: string,
    allBadges: Badge[],
    earned: UserBadge[],
    points: number,
    streak: StreakInfo,
    totalDays: number
  ) => {
    const earnedIds = new Set(earned.map((e) => e.badge_id));
    const toAward: string[] = [];

    for (const badge of allBadges) {
      if (earnedIds.has(badge.id)) continue;

      let qualifies = false;
      switch (badge.requirement_type) {
        case "points":
          qualifies = points >= badge.requirement_value;
          break;
        case "streak_days":
          qualifies = streak.longestStreak >= badge.requirement_value;
          break;
        case "total_days":
          qualifies = totalDays >= badge.requirement_value;
          break;
        // challenges_won would need separate query, skip for now
      }

      if (qualifies) toAward.push(badge.id);
    }

    if (toAward.length > 0) {
      const inserts = toAward.map((badge_id) => ({ user_id: uid, badge_id }));
      await supabase.from("user_badges").insert(inserts);
      // Reload to update UI
      setData((prev) => ({
        ...prev,
        earnedBadgeIds: [...prev.earnedBadgeIds, ...toAward],
      }));
    }
  };

  return data;
}
