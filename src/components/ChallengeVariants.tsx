import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { HealthService } from "@/services/healthService";

const variants = [
  { id: 1, title: "Variante 1", description: "Mind. 3000 Schritte am Tag", requiresSteps: true },
  { id: 2, title: "Variante 2", description: "20 Kniebeugen" },
  { id: 3, title: "Variante 3", description: "30 Sekunden Plank" },
  { id: 4, title: "Variante 4", description: "15 Hampelmänner" },
];

export const ChallengeVariants = () => {
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const [currentSteps, setCurrentSteps] = useState<number>(0);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);

  useEffect(() => {
    checkHealthAvailability();
  }, []);

  const checkHealthAvailability = async () => {
    const available = await HealthService.isAvailable();
    setHealthAvailable(available);
    if (available) {
      await requestHealthPermission();
    }
  };

  const requestHealthPermission = async () => {
    const granted = await HealthService.requestAuthorization();
    if (granted) {
      await fetchSteps();
    } else {
      toast.error("Zugriff auf Health App wurde nicht gewährt");
    }
  };

  const fetchSteps = async () => {
    setIsLoadingSteps(true);
    try {
      const steps = await HealthService.getTodaySteps();
      setCurrentSteps(steps);
      toast.success(`${steps} Schritte heute geladen`);
    } catch (error) {
      toast.error("Fehler beim Laden der Schritte");
    } finally {
      setIsLoadingSteps(false);
    }
  };

  const handleSelect = (id: number) => {
    setSelectedVariant(id);
    const variant = variants.find(v => v.id === id);
    
    if (variant?.requiresSteps && currentSteps < 3000) {
      toast.error(`Du hast erst ${currentSteps} Schritte. Ziel: 3000 Schritte!`);
      return;
    }
    
    toast.success(`${variant?.title} ausgewählt!`);
  };

  return (
    <div className="mb-20">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-foreground">
          Wähle deine Variante:
        </h3>
        {healthAvailable && (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSteps}
            disabled={isLoadingSteps}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingSteps ? 'animate-spin' : ''}`} />
            Schritte aktualisieren
          </Button>
        )}
      </div>
      
      {healthAvailable && currentSteps > 0 && (
        <div className="mb-4 p-3 bg-primary/10 rounded-lg">
          <p className="text-sm font-semibold text-foreground">
            Heutige Schritte: {currentSteps.toLocaleString()}
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-3">
        {variants.map((variant) => (
          <Card
            key={variant.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedVariant === variant.id
                ? "bg-primary/10 border-primary shadow-lg"
                : "bg-card hover:shadow-md"
            }`}
            onClick={() => handleSelect(variant.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-foreground">{variant.title}</h4>
              {selectedVariant === variant.id && (
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{variant.description}</p>
            {variant.requiresSteps && currentSteps > 0 && (
              <p className={`text-xs mt-2 font-semibold ${
                currentSteps >= 3000 ? 'text-green-600' : 'text-orange-600'
              }`}>
                {currentSteps >= 3000 ? '✓ Ziel erreicht!' : `${3000 - currentSteps} Schritte fehlen`}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
