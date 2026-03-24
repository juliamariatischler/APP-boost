import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import boostLogo from "@/assets/boost-logo.png";
import { Dumbbell, Brain } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    setLoading(false);
    
    if (!session) {
      const nextPath = location.search ? `/auth${location.search}` : "/auth";
      navigate(nextPath);
    }
  };

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-4xl w-full">
        <img 
          src={boostLogo} 
          alt="BOOST Logo" 
          className="h-32 w-auto mx-auto mb-8"
        />
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
          BOOST Challenge
        </h1>
        <p className="text-xl md:text-2xl mb-12 text-muted-foreground">
          Wähle deine Challenge aus
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="p-8 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-card"
            onClick={() => navigate("/dashboard")}
          >
            <Dumbbell className="h-20 w-20 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-3 text-foreground">
              Body Boost
            </h2>
            <p className="text-muted-foreground mb-4">
              Bewege dich, sammle Blitze und fordere deine Freunde heraus!
            </p>
            <Button size="lg" className="w-full">
              Starten
            </Button>
          </Card>

          <Card 
            className="p-8 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-card"
            onClick={() => navigate("/mental")}
          >
            <Brain className="h-20 w-20 mx-auto mb-4 text-secondary" />
            <h2 className="text-2xl font-bold mb-3 text-foreground">
              Mind Boost
            </h2>
            <p className="text-muted-foreground mb-4">
              Trainiere deinen Geist und verbessere deine mentale Stärke!
            </p>
            <Button size="lg" variant="secondary" className="w-full">
              Starten
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
