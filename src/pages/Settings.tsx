import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HealthService } from "@/services/healthService";
import { CheckCircle2, HeartPulse } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [checkingHealth, setCheckingHealth] = useState(true);
  const [connectingHealth, setConnectingHealth] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);

  useEffect(() => {
    const checkHealthAvailability = async () => {
      setCheckingHealth(true);
      const available = await HealthService.isAvailable();
      setHealthAvailable(available);
      setCheckingHealth(false);
    };

    checkHealthAvailability();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Erfolgreich abgemeldet");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Fehler beim Abmelden: " + error.message);
    }
  };

  const isHealthSupported = HealthService.isHealthPlatformSupported();
  const healthSourceLabel = HealthService.getHealthSourceLabel();

  const handleConnectHealthData = async () => {
    if (!isHealthSupported) {
      toast.info("Health-Sync ist nur auf iPhone oder Android verfügbar.");
      return;
    }

    setConnectingHealth(true);
    const connected = await HealthService.connectHealthData();
    setConnectingHealth(false);

    if (connected) {
      toast.success(`${healthSourceLabel} erfolgreich verbunden.`);
      setHealthAvailable(true);
      return;
    }

    toast.error(`${healthSourceLabel} konnte nicht verbunden werden.`, {
      description: "Bitte prüfe die Health-Berechtigungen auf deinem Gerät."
    });
  };

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader />

      <div className="max-w-screen-xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Einstellungen</h1>

        <Card className="p-6 bg-card shadow-card mb-4">
          <div className="flex items-center gap-3 mb-3">
            <HeartPulse className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Health-Daten</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Verbinde Apple Health (iOS) oder Health Connect (Android), um echte Schrittzahlen zu synchronisieren.
          </p>

          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Status</span>
            {checkingHealth ? (
              <span className="text-sm text-muted-foreground">Wird geprüft...</span>
            ) : healthAvailable && isHealthSupported ? (
              <span className="inline-flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Verfügbar
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {isHealthSupported
                  ? "Nicht verfügbar"
                  : "Nur in der nativen iOS- oder Android-App verfügbar"}
              </span>
            )}
          </div>

          <Button
            onClick={handleConnectHealthData}
            disabled={connectingHealth || !isHealthSupported}
            className="w-full"
          >
            {connectingHealth ? "Verbinde..." : "Health-Daten verbinden"}
          </Button>
        </Card>

        <Card className="p-6 bg-card shadow-card">
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full"
          >
            Abmelden
          </Button>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
