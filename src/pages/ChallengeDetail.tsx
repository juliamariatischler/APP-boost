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

const challengeData: Record<string, { title: string; image: string; description: string }> = {
  daily: {
    title: "Tägliche Challenge",
    image: dailyImg,
    description: "Kurze, kindgerechte Bewegungsimpulse mit reduzierten Wiederholungen und rotierendem Trainingsfokus.",
  },
  weekly: {
    title: "2-Wochenchallenge",
    image: weeklyImg,
    description: "Die Wochenchallenge bleibt ein Bereich, bietet jetzt aber zwei klar getrennte Wege zur Teilnahme.",
  },
  friend: {
    title: "Friendquest Challenge",
    image: friendImg,
    description: "Fordere deine Freunde heraus und habt zusammen Spaß an der Bewegung!",
  },
  tryit: {
    title: "Try It Challenge",
    image: tryitImg,
    description: "Ein gemeinsames Try-It-System mit emotionalerer Vereinsdarstellung, stärkerem Branding und klarerem Belohnungsgefühl.",
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
              <div className="mb-8 rounded-lg border bg-muted/30 p-4 space-y-3">
                <h2 className="text-xl font-bold text-foreground">So funktioniert die 2-Wochenchallenge</h2>
                <div className="rounded-lg border bg-background p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">Dein Fortschritt</span>
                    <span className="font-bold text-primary">{weeklyProgress}%</span>
                  </div>
                  <Progress value={weeklyProgress} className="h-2.5" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Gezählt werden aktive Tage in den letzten 14 Tagen.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Strategisch bleibt alles vorerst in einer Kategorie. So bleibt die Navigation schlank, während beide Wege
                  inhaltlich klar getrennt kommuniziert werden können.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
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
                      <p>Kein QR-Scan noetig, sondern physischer Cache mit Fundcode oder Logbuch.</p>
                      <p>Digitale Punktevergabe nach validiertem Fund in der App.</p>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-primary">Jetzt öffnen</p>
                  </button>
                </div>

                <div className="space-y-2 text-sm text-foreground">
                  <p>1. Öffne die Wochenchallenge und wähle einen der beiden Wege.</p>
                  <p>2. Sammle über 14 Tage aktive Tage durch Bewegung, Übungen oder validierte Teilnahme.</p>
                  <p>3. Der Fortschritt steigt weiter über aktive Tage, unabhängig davon, welche Option du nutzt.</p>
                </div>
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
