import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import boostLogo from "@/assets/boost-logo.png";
import { Brain } from "lucide-react";

const MentalIndex = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-2xl">
        <img 
          src={boostLogo} 
          alt="BOOST Logo" 
          className="h-32 w-auto mx-auto mb-8"
        />
        <Brain className="h-24 w-24 mx-auto mb-6 text-secondary" />
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
          Mentale Challenge
        </h1>
        <p className="text-xl md:text-2xl mb-8 text-muted-foreground">
          Trainiere deinen Geist und verbessere deine mentale Stärke!
        </p>
        <Button 
          size="lg" 
          variant="secondary"
          className="text-lg px-8 py-6"
          onClick={() => navigate("/auth")}
        >
          Jetzt starten
        </Button>
      </div>
    </div>
  );
};

export default MentalIndex;
