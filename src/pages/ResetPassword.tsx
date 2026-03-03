import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Check URL hash for recovery type
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error("Das Passwort muss mindestens 6 Zeichen haben");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Die Passwörter stimmen nicht überein");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error("Fehler beim Zurücksetzen: " + error.message);
      } else {
        toast.success("Passwort erfolgreich geändert!");
        navigate("/dashboard");
      }
    } catch {
      toast.error("Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <img src={boostLogo} alt="BOOST Logo" className="h-16 w-auto mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            Ungültiger oder abgelaufener Link. Bitte fordere einen neuen Link an.
          </p>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Zurück zur Anmeldung
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex justify-center mb-6">
          <img src={boostLogo} alt="BOOST Logo" className="h-16 w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-6 text-foreground">
          Neues Passwort setzen
        </h1>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <Label htmlFor="new-password">Neues Passwort</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Passwort bestätigen</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Passwort ändern
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ResetPassword;
