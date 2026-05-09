import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BOOST_POINT_RULES,
  getLevelForPoints,
  calculateStreak,
  getEnergyRank,
  isStreakEligibleDay,
  type LevelInfo,
  type StreakInfo,
  type EnergyRank,
} from "@/lib/gamification";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { getDemoAwarePoints } from "@/lib/demo";

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

interface ClassParticipation {
  total_students: number;
  active_students: number;
  participation_pct: number;
  streak_alive: boolean;
}

export interface GamificationData {
  points: number;
  level: LevelInfo;
  streak: StreakInfo;
  weeklyCompletedDays: number;
  allBadges: Badge[];
  earnedBadgeIds: string[];
  totalCompletedDays: number;
  rescueDaysUsed: number;
  classParticipation: ClassParticipation | null;
  classAverage: number;
  energyRank: EnergyRank;
  loading: boolean;
}

export function useGamification(userId: string | null, userClass?: string, userSchool?: string): GamificationData {
  const [data, setData] = useState<GamificationData>({
    points: 0,
    level: getLevelForPoints(0),
    streak: { currentStreak: 0, longestStreak: 0 },
    weeklyCompletedDays: 0,
    allBadges: [],
    earnedBadgeIds: [],
    totalCompletedDays: 0,
    rescueDaysUsed: 0,
    classParticipation: null,
    classAverage: 0,
    energyRank: "gleich",
    loading: true,
  });

  useEffect(() => {
    if (!userId) return;
    loadGamificationData(userId);
  }, [userId, userClass, userSchool]);

  useEffect(() => {
    const handlePointsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ delta?: number }>;
      const delta = Number(customEvent.detail?.delta || 0);
      if (!delta) return;

      setData((prev) => {
        const nextPoints = prev.points + delta;
        return {
          ...prev,
          points: nextPoints,
          level: getLevelForPoints(nextPoints),
          energyRank: getEnergyRank(nextPoints, prev.classAverage),
        };
      });
    };

    window.addEventListener("points-updated", handlePointsUpdated);
    return () => {
      window.removeEventListener("points-updated", handlePointsUpdated);
    };
  }, []);

  const loadGamificationData = async (uid: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email;

      const baseQueries = [
        supabase.from("profiles").select("points, rescue_days_used, last_rescue_reset").eq("id", uid).single(),
        supabase.from("daily_results").select("*").eq("user_id", uid).order("date", { ascending: false }),
        supabase.from("badges").select("*"),
        supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", uid),
      ] as const;

      const classQueries = userClass && userSchool ? [
        supabase.rpc("get_class_participation", { p_class: userClass, p_school: userSchool }),
        supabase.rpc("get_class_average_points", { p_class: userClass, p_school: userSchool }),
      ] as const : [];

      const results = await Promise.all([...baseQueries, ...classQueries]);
      const [profileRes, allResultsRes, badgesRes, userBadgesRes] = results;

      const points = getDemoAwarePoints(profileRes.data?.points, email);
      const rescueDaysUsed = profileRes.data?.rescue_days_used || 0;
      const allResults = allResultsRes.data || [];
      const allBadges = (badgesRes.data || []) as Badge[];
      const userBadges = (userBadgesRes.data || []) as UserBadge[];

      let classParticipation: ClassParticipation | null = null;
      let classAverage = 0;

      if (results.length > 4) {
        classParticipation = results[4].data as ClassParticipation | null;
        classAverage = Number(results[5].data) || 0;
      }

      const completedDates = allResults
        .filter(isStreakEligibleDay)
        .map((r: any) => r.date);

      const streak = calculateStreak(completedDates);
      const totalCompletedDays = completedDates.length;

      const today = new Date();
      const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");

      const weeklyCompletedDays = allResults
        .filter((r: any) => r.date >= weekStartStr && r.date <= weekEndStr && isStreakEligibleDay(r))
        .length;

      const energyRank = getEnergyRank(points, classAverage);

      setData({
        points,
        level: getLevelForPoints(points),
        streak,
        weeklyCompletedDays,
        allBadges,
        earnedBadgeIds: userBadges.map((ub) => ub.badge_id),
        totalCompletedDays,
        rescueDaysUsed,
        classParticipation,
        classAverage,
        energyRank,
        loading: false,
      });

      await checkAndAwardBadges(uid, allBadges, userBadges, points, streak, totalCompletedDays);
      await checkAndAwardStreakBonus(uid, streak, completedDates);
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
      }

      if (qualifies) toAward.push(badge.id);
    }

    if (toAward.length > 0) {
      const inserts = toAward.map((badge_id) => ({ user_id: uid, badge_id }));
      await supabase.from("user_badges").insert(inserts);
      setData((prev) => ({
        ...prev,
        earnedBadgeIds: [...prev.earnedBadgeIds, ...toAward],
      }));
    }
  };

  const checkAndAwardStreakBonus = async (uid: string, streak: StreakInfo, completedDates: string[]) => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (!completedDates.includes(today)) return;

    const streakRewards: Record<number, number> = {
      3: BOOST_POINT_RULES.streak3DaysBonus,
      7: BOOST_POINT_RULES.streak7DaysBonus,
    };

    const reward = streakRewards[streak.currentStreak];
    if (!reward) return;

    const bonusKey = `boost_streak_bonus_${uid}_${today}_${streak.currentStreak}`;
    if (localStorage.getItem(bonusKey) === "awarded") return;

    const { error } = await supabase.rpc("increment_points", { points_to_add: reward });
    if (error) {
      console.error("Streak bonus error:", error);
      return;
    }

    localStorage.setItem(bonusKey, "awarded");
    window.dispatchEvent(new CustomEvent("points-updated", { detail: { delta: reward } }));
  };

  return data;
}
