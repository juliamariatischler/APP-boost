import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ForgotPasswordProps {
  onBack: () => void;
}

const ForgotPassword = ({ onBack }: ForgotPasswordProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Bitte gib deine E-Mail-Adresse ein");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error("Fehler: " + error.message);
      } else {
        setSent(true);
        toast.success("E-Mail zum Zurücksetzen gesendet!");
      }
    } catch {
      toast.error("Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Falls ein Konto mit dieser E-Mail existiert, erhältst du einen Link zum Zurücksetzen deines Passworts.
        </p>
        <Button variant="outline" onClick={onBack} className="w-full">
          Zurück zur Anmeldung
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen.
      </p>
      <div>
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="deine@email.de"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Link senden
      </Button>
      <Button type="button" variant="ghost" onClick={onBack} className="w-full">
        Zurück zur Anmeldung
      </Button>
    </form>
  );
};

export default ForgotPassword;
