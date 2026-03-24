import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { LevelCard } from "@/components/boost/LevelCard";
import { StreakCard } from "@/components/boost/StreakCard";
import { BadgesCard } from "@/components/boost/BadgesCard";
import { ClassLeaderboard } from "@/components/boost/ClassLeaderboard";
import { ClassParticipationCard } from "@/components/boost/ClassParticipationCard";
import { EnergyRankCard } from "@/components/boost/EnergyRankCard";
import { ChallengeButtons } from "@/components/boost/ChallengeButtons";
import { useGamification } from "@/hooks/useGamification";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BOOST_POINT_RULES } from "@/lib/gamification";
import { Zap, Trophy, Users, School } from "lucide-react";

const Boost = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userClass, setUserClass] = useState("");
  const [userSchool, setUserSchool] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  const gamification = useGamification(userId, userClass, userSchool);

  useEffect(() => {
    const init = async () => {
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
    init();
  }, [navigate]);

  if (authLoading || gamification.loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="animate-pulse h-96 m-4 bg-muted rounded-lg" />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader />
      <div className="max-w-md mx-auto px-4 -mt-4 space-y-3">
        <Card className="border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">BOOST-System</p>
          <h1 className="mt-2 text-xl font-black text-foreground">Blitze, Level, Challenges, Klasse</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Blitze sind die zentrale Währung in BOOST. Sie machen Fortschritt sichtbar, bringen Kinder täglich zurück
            und verbinden persönliche Motivation mit dem Erfolg der ganzen Klasse.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Die genaue Übersicht, wie viele Blitze es pro Aktion gibt, findest du unten bei „Mehr Blitze gefällig?“.
          </p>
        </Card>

        <Card className="p-4 bg-card shadow-lg">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 fill-primary text-primary" />
            <h2 className="text-base font-bold text-foreground">Motivation, die Kinder verstehen</h2>
          </div>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
            <p>Täglich zurückkommen, Fortschritt sehen und durch klare Belohnungen sofort verstehen, wofür es Blitze gibt.</p>
            <p>Level, Badges, Streaks und sichtbare Balken sorgen dafür, dass Leistung nicht abstrakt bleibt.</p>
            <p>Das Klassenranking macht aus Einzelmotivation ein Teamziel und stärkt gleichzeitig den sozialen Vergleich.</p>
          </div>
        </Card>

        <Card className="p-4 bg-card shadow-lg">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Challenge-Logik</h2>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <p>Wochenchallenge: 5 aktive Tage oder ein klares Wochenformat abschließen und Badge plus {BOOST_POINT_RULES.weeklyChallengeCompleted} Blitze holen.</p>
            <p>Try-It-Challenge: echte Sportarten, Trainings oder Vereine testen und pro neuem Erlebnis {BOOST_POINT_RULES.tryItCompleted} Blitze sammeln.</p>
            <p>Retention-Trigger: Streak-System, Fortschrittsbalken und kurze Hinweise wie „Heute fehlt nur noch 1 Übung“.</p>
          </div>
        </Card>

        <Card className="p-4 bg-card shadow-lg">
          <div className="flex items-center gap-2">
            <School className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Einfach für Schulen</h2>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <p>Schule meldet sich an, Klassen werden angelegt und Lehrkräfte bekommen direkt ihren Zugang.</p>
            <p>Schüler:innen nutzen BOOST zuhause oder in kurzen 5- bis 10-Minuten-Slots vor dem Unterricht, in Pausen oder im Sport.</p>
            <p>Lehrkräfte sehen Aktivität und Fortschritt der Klasse, ohne jede Übung einzeln kontrollieren zu müssen.</p>
          </div>
        </Card>

        <LevelCard points={gamification.points} level={gamification.level} />
        <StreakCard streak={gamification.streak} weeklyCompletedDays={gamification.weeklyCompletedDays} />
        
        {/* Class participation - the game changer */}
        {gamification.classParticipation && (
          <ClassParticipationCard
            participation={gamification.classParticipation}
            userClass={userClass}
            rescueDaysUsed={gamification.rescueDaysUsed}
          />
        )}
        
        {/* Energy rank vs class average */}
        <EnergyRankCard
          userPoints={gamification.points}
          classAverage={gamification.classAverage}
          energyRank={gamification.energyRank}
        />
        
        <BadgesCard allBadges={gamification.allBadges} earnedBadgeIds={gamification.earnedBadgeIds} />
        <ClassLeaderboard userClass={userClass} userSchool={userSchool} />
        <ChallengeButtons />
      </div>
      <BottomNav />
    </div>
  );
};

export default Boost;
