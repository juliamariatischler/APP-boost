import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Zap } from "lucide-react";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { BottomNav } from "@/components/BottomNav";
import { StreakCard } from "@/components/boost/StreakCard";
import { BadgesCard } from "@/components/boost/BadgesCard";
import { ClassLeaderboard } from "@/components/boost/ClassLeaderboard";
import { ClassParticipationCard } from "@/components/boost/ClassParticipationCard";
import { EnergyRankCard } from "@/components/boost/EnergyRankCard";
import { useGamification } from "@/hooks/useGamification";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BOOST_POINT_RULES } from "@/lib/gamification";

// Must match STEP_TASK_REWARD in Dashboard.tsx
const STEP_TASK_REWARD = 5;

const EARN_ROWS = [
  {
    emoji: "🏋️",
    label: "Übung erledigt",
    sub: "Push-ups, Squats, Planks & Co.",
    reward: BOOST_POINT_RULES.exerciseCompleted,
    bonus: false,
    colorBg: "bg-sky-500/12",
    colorText: "bg-sky-500/15 text-sky-700",
  },
  {
    emoji: "👟",
    label: "3.000 Schritte",
    sub: "Zählt automatisch per iPhone",
    reward: STEP_TASK_REWARD,
    bonus: false,
    colorBg: "bg-emerald-500/12",
    colorText: "bg-emerald-500/15 text-emerald-700",
  },
  {
    emoji: "⭐",
    label: "Alle 6 Aufgaben",
    sub: "Komplett-Bonus für den ganzen Tag",
    reward: BOOST_POINT_RULES.dailyGoalCompleted,
    bonus: true,
    colorBg: "bg-yellow-400/12",
    colorText: "bg-yellow-400/20 text-yellow-700",
  },
  {
    emoji: "🔥",
    label: "3 Tage hintereinander",
    sub: "Bleib dabei – das lohnt sich!",
    reward: BOOST_POINT_RULES.streak3DaysBonus,
    bonus: true,
    colorBg: "bg-orange-500/12",
    colorText: "bg-orange-500/15 text-orange-700",
  },
  {
    emoji: "💥",
    label: "7 Tage am Stück",
    sub: "Eine ganze Woche – Mega!",
    reward: BOOST_POINT_RULES.streak7DaysBonus,
    bonus: true,
    colorBg: "bg-rose-500/12",
    colorText: "bg-rose-500/15 text-rose-700",
  },
  {
    emoji: "📅",
    label: "Wochenmission",
    sub: "5 aktive Tage in einer Woche",
    reward: BOOST_POINT_RULES.weeklyChallengeCompleted,
    bonus: false,
    colorBg: "bg-indigo-500/12",
    colorText: "bg-indigo-500/15 text-indigo-700",
  },
  {
    emoji: "⚔️",
    label: "Freunde-Quest",
    sub: "Gemeinsam mit Klassenkamerad:innen",
    reward: BOOST_POINT_RULES.friendQuestCompleted,
    bonus: false,
    colorBg: "bg-purple-500/12",
    colorText: "bg-purple-500/15 text-purple-700",
  },
  {
    emoji: "🗺️",
    label: "Try It",
    sub: "Neue Sportart ausprobieren",
    reward: BOOST_POINT_RULES.tryItCompleted,
    bonus: false,
    colorBg: "bg-amber-500/12",
    colorText: "bg-amber-400/20 text-amber-700",
  },
] as const;

const Boost = () => {
  const navigate = useNavigate();
  const { session: codeSession, loading: codeAuthLoading } = useCodeAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [userClass, setUserClass] = useState("");
  const [userSchool, setUserSchool] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  const gamification = useGamification(userId, userClass, userSchool);

  useEffect(() => {
    const init = async () => {
      if (codeAuthLoading) return;
      if (codeSession?.user_type === "student") {
        setUserId(codeSession.user_id);
        setUserClass(codeSession.class_name || "");
        setUserSchool(codeSession.school_name || "");
        setAuthLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/"); return; }
      setUserId(session.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("class, school")
        .eq("id", session.user.id)
        .single();
      if (profile) {
        setUserClass(profile.class);
        setUserSchool(profile.school);
      }
      setAuthLoading(false);
    };
    void init();
  }, [navigate, codeSession, codeAuthLoading]);

  if (authLoading || gamification.loading) {
    return (
      <div className="min-h-screen bg-background pb-nav-safe">
        <div className="mx-auto max-w-screen-xl space-y-4 px-4 pt-3">
          <Skeleton className="h-10 w-40 rounded-full" />
          <Skeleton className="h-44 w-full rounded-[28px]" />
          <Skeleton className="h-[22rem] w-full rounded-[26px]" />
          <Skeleton className="h-40 w-full rounded-[26px]" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <div className="mx-auto max-w-screen-xl px-4 pt-3">

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <p className="text-[15px] font-semibold text-muted-foreground leading-none">Profil</p>
            <h1 className="text-[1.9rem] font-black leading-none tracking-tight text-foreground">BOOST-System</h1>
          </div>
        </div>

        {/* Hero card */}
        <div className="mb-4 overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_20%_80%,rgba(50,255,200,0.3)_0%,transparent_40%),linear-gradient(135deg,#075cff_0%,#078cff_48%,#16c7e9_100%)] px-5 py-5 shadow-[0_18px_34px_rgba(0,83,255,0.2)]">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/16 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
            <Zap className="h-3 w-3 fill-white" />
            So funktioniert BOOST
          </p>
          <h2 className="text-[1.5rem] font-black leading-tight text-white">
            Mach Aufgaben.<br />Sammle Blitze. ⚡
          </h2>
          <p className="mt-2 text-[0.82rem] font-semibold leading-relaxed text-white/85">
            Jeden Tag gibt es Übungen und Schritte zu erledigen. Für jede erledigte Aufgabe bekommst du Blitze – und deine ganze Klasse profitiert davon!
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Täglich Punkte", value: "bis +26 ⚡" },
              { label: "Serien-Bonus", value: "bis +15 ⚡" },
              { label: "Wochenmission", value: `+${BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[14px] bg-white/14 px-2 py-2 text-center backdrop-blur-sm">
                <p className="text-[11px] font-black text-white">{stat.value}</p>
                <p className="mt-0.5 text-[9px] font-semibold text-white/75 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Earn rows */}
        <div className="mb-4 overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="border-b border-black/[0.05] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              So bekommst du Blitze
            </p>
          </div>
          {EARN_ROWS.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center gap-3 px-4 py-3 ${i < EARN_ROWS.length - 1 ? "border-b border-black/[0.04]" : ""}`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-lg ${row.colorBg}`}>
                {row.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black leading-tight text-foreground">{row.label}</p>
                <p className="text-[11px] text-muted-foreground">{row.sub}</p>
              </div>
              <div className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black whitespace-nowrap ${row.colorText}`}>
                +{row.reward} ⚡{row.bonus ? " Bonus" : ""}
              </div>
            </div>
          ))}
        </div>

        {/* Stats components */}
        <div className="space-y-3">
          <StreakCard streak={gamification.streak} weeklyCompletedDays={gamification.weeklyCompletedDays} />
          {gamification.classParticipation && (
            <ClassParticipationCard
              participation={gamification.classParticipation}
              userClass={userClass}
              rescueDaysUsed={gamification.rescueDaysUsed}
            />
          )}
          <EnergyRankCard
            userPoints={gamification.points}
            classAverage={gamification.classAverage}
            energyRank={gamification.energyRank}
          />
          <BadgesCard allBadges={gamification.allBadges} earnedBadgeIds={gamification.earnedBadgeIds} />
          <ClassLeaderboard userClass={userClass} userSchool={userSchool} />
        </div>

      </div>
      <BottomNav />
    </div>
  );
};

export default Boost;
