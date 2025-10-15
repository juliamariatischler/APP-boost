import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import boostLogo from "@/assets/boost-logo.png";
import heroBackground from "@/assets/hero-bg.jpg";

export const WelcomeHero = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${heroBackground})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/80 to-background" />
      
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <img 
            src={boostLogo} 
            alt="Boost Logo" 
            className="h-24 w-auto mx-auto drop-shadow-lg"
          />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent animate-fade-in-up">
          Willkommen
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 animate-fade-in-up animation-delay-200">
          Meistere tägliche Challenges und sammle Belohnungen!
        </p>
        
        <Button 
          onClick={() => navigate('/challenges')}
          size="lg"
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300 text-lg px-8 py-6 rounded-full shadow-glow animate-fade-in-up animation-delay-400"
        >
          Los geht's!
        </Button>
      </div>
    </div>
  );
};
