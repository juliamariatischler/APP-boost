import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-bg.jpg";
import boostLogo from "@/assets/boost-logo.png";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div 
      className="min-h-screen bg-cover bg-center relative flex flex-col"
      style={{ backgroundImage: `url(${heroImage})` }}
    >
      <div className="absolute inset-0 bg-black/50" />
      
      <div className="relative z-10 flex-1 flex flex-col">
        <header className="p-6">
          <img src={boostLogo} alt="BOOST Logo" className="h-16 w-auto" />
        </header>

        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center text-white max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              BOOST Challenge
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90">
              Bewege dich, sammle Punkte und fordere deine Freunde heraus!
            </p>
            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => navigate("/auth")}
            >
              Jetzt starten
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
