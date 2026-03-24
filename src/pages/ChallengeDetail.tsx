import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";
import TrialSessionsList from "@/components/TrialSessionsList";
import { DailyChallengeContent } from "@/components/DailyChallengeContent";
import { TopHeader } from "@/components/TopHeader";
import { BottomNav } from "@/components/BottomNav";
import { format, subDays } from "date-fns";
import { isDemoEmail } from "@/lib/demo";
import { BOOST_POINT_RULES } from "@/lib/gamification";

const challengeData: Record<string, { title: string; image: string; description: string }> = {
  daily: {
    title: "Tägliche Challenge",
    image: dailyImg,
    description: "Kurze, kindgerechte Bewegungsimpulse mit reduzierten Wiederholungen und rotierendem Trainingsfokus. Unsere Übungen basieren auf internationalen Trainingsrichtlinien für Kinder und sind speziell auf Sicherheit, Einfachheit und Skalierbarkeit ausgelegt.",
  },
  weekly: {
    title: "Wochenchallenge",
    image: weeklyImg,
    description: `Die Wochenchallenge bringt Rückkehr in die App: 5 aktive Tage oder ein klarer Wochenmodus für +${BOOST_POINT_RULES.weeklyChallengeCompleted} Blitze.`,
  },
  friend: {
    title: "Friendquest Challenge",
    image: friendImg,
    description: "Fordere deine Freunde heraus und habt zusammen Spaß an der Bewegung!",
  },
  tryit: {
    title: "Try It Challenge",
    image: tryitImg,
    description: `Ein gemeinsames Try-It-System mit echten Sportarten, Vereinsnähe und +${BOOST_POINT_RULES.tryItCompleted} Blitzen pro neuem Erlebnis.`,
  },
};

const ChallengeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserId(session.user.id);

    if (id === "weekly") {
      const today = new Date().toISOString().split("T")[0];
      const fourteenDaysAgo = format(subDays(new Date(), 13), "yyyy-MM-dd");
      const demoUser = isDemoEmail(session.user.email);

      const { data, error } = await supabase
        .from("daily_results")
        .select("jumping_jacks, push_ups, squats, planks, sit_ups, steps")
        .eq("user_id", session.user.id)
        .gte("date", fourteenDaysAgo)
        .lte("date", today);

      if (!error && data && data.length > 0) {
        const activeDays = data.filter((day) =>
          (day.steps || 0) > 0 ||
          (day.jumping_jacks || 0) > 0 ||
          (day.push_ups || 0) > 0 ||
          (day.squats || 0) > 0 ||
          (day.planks || 0) > 0 ||
          (day.sit_ups || 0) > 0
        ).length;
        const computedProgress = Math.round((activeDays / 14) * 100);
        setWeeklyProgress(demoUser ? Math.max(26, computedProgress) : computedProgress);
      } else {
        setWeeklyProgress(demoUser ? 26 : 0);
      }
    }
  };

  const challenge = id ? challengeData[id] : null;

  if (!challenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Challenge nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <TopHeader />

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 pb-8">
        {id === "daily" && userId ? (
          <DailyChallengeContent userId={userId} />
        ) : (
          <Card className="p-6 bg-card shadow-card">
            <h1 className="text-3xl font-bold mb-4 text-center text-foreground">
              {challenge.title}
            </h1>

            <div className="mb-6 rounded-lg overflow-hidden">
              <img
                src={challenge.image}
                alt={challenge.title}
                className="w-full h-auto"
              />
            </div>

            <p className="text-lg text-muted-foreground mb-8 text-center">
              {challenge.description}
            </p>

            {id === "weekly" && (
              <div className="mb-8 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => navigate("/challenge/weekly/athlete")}
                  className="rounded-xl border bg-background p-4 text-left transition hover:border-primary hover:shadow-md"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Option A</p>
                  <h3 className="text-lg font-bold text-foreground">Spitzensportler-Challenge</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Motivationsvideos von Spitzensportler:innen geben den emotionalen Einstieg. Kinder absolvieren danach
                    eine klar vorgegebene Challenge.
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-foreground">
                    <p>Inspiration durch Vorbilder und starke Emotionen.</p>
                    <p>Klare Challenge-Struktur mit hohem Aktivierungsfaktor.</p>
                    <p>Ideal für Kampagnen, Highlights und Storytelling.</p>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-primary">Jetzt öffnen</p>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/challenge/weekly/geotracking")}
                  className="rounded-xl border bg-background p-4 text-left transition hover:border-primary hover:shadow-md"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Option B</p>
                  <h3 className="text-lg font-bold text-foreground">Geocaching x BOOST</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Die Logik orientiert sich an echtem Geocaching: Kinder steuern Orte an, finden physische Verstecke
                    und loggen den Fund danach digital in BOOST.
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-foreground">
                    <p>Bewegung draussen mit Suchreiz, Orientierung und echten Fundmomenten.</p>
                    <p>Kein QR-Scan nötig, sondern physischer Cache mit Fundcode oder Logbuch.</p>
                    <p>Digitale Blitzevergabe nach validiertem Fund in der App.</p>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-primary">Jetzt öffnen</p>
                </button>
              </div>
            )}

            {id === "tryit" && <TrialSessionsList />}
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ChallengeDetail;
