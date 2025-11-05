import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { WeekOverview } from "@/components/WeekOverview";
import { supabase } from "@/integrations/supabase/client";
import boostLogo from "@/assets/boost-logo.png";

const Activity = () => {
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

  return (
    <div className="min-h-screen bg-background pb-16">
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

      <div className="max-w-screen-xl mx-auto px-4 space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Meine Aktivitäten</h1>

        {userId && <WeekOverview userId={userId} />}
      </div>

      <BottomNav />
    </div>
  );
};

export default Activity;
