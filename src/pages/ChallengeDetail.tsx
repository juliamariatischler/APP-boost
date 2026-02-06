import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import dailyImg from "@/assets/challenge-daily.jpg";
import weeklyImg from "@/assets/challenge-weekly.jpg";
import friendImg from "@/assets/challenge-friend.jpg";
import tryitImg from "@/assets/challenge-tryit.jpg";
import boostLogo from "@/assets/boost-logo.png";
import TrialSessionsList from "@/components/TrialSessionsList";
import { DailyChallengeContent } from "@/components/DailyChallengeContent";

const challengeData: Record<string, { title: string; image: string; description: string }> = {
  daily: {
    title: "Tägliche Challenge",
    image: dailyImg,
    description: "Absolviere beide Pflichtteile und bleib aktiv!",
  },
  weekly: {
    title: "Wochenaufgaben Challenge",
    image: weeklyImg,
    description: "Meistere die Herausforderungen dieser Woche gemeinsam mit deinen Mitschülern!",
  },
  friend: {
    title: "Friendquest Challenge",
    image: friendImg,
    description: "Fordere deine Freunde heraus und habt zusammen Spaß an der Bewegung!",
  },
  tryit: {
    title: "Try It Challenge",
    image: tryitImg,
    description: "Probiere etwas Neues aus und erweitere deine Bewegungsfähigkeiten!",
  },
};

const ChallengeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm p-4 mb-6">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          <img src={boostLogo} alt="BOOST Logo" className="h-12 w-auto" />
        </div>
      </div>

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

            {id === "tryit" && <TrialSessionsList />}
          </Card>
        )}
      </div>
    </div>
  );
};

export default ChallengeDetail;
