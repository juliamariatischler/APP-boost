import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, QrCode, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCodeAuth } from "@/contexts/CodeAuthContext";

const normalizeCode = (value: string) => value.replace(/\s+/g, "").toUpperCase();

export default function Activate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activate } = useCodeAuth();
  const [code, setCode] = useState(() => normalizeCode(searchParams.get("code") || ""));
  const [submitting, setSubmitting] = useState(false);

  const submitActivation = async (activationCode: string) => {
    const normalized = normalizeCode(activationCode);
    if (!normalized) {
      toast.error("Bitte gib den Aktivierungscode ein.");
      return;
    }

    setSubmitting(true);
    try {
      const session = await activate(normalized);
      if (session.user_type !== "student") {
        throw new Error("Dieser Code ist kein Schülerzugang.");
      }
      toast.success("Profil aktiviert.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aktivierung fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const initialCode = normalizeCode(searchParams.get("code") || "");
    if (!initialCode) return;
    void submitActivation(initialCode);
    // The initial QR scan should run once for the URL code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitActivation(code);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Zap className="h-6 w-6 fill-current" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">BOOST</p>
            <h1 className="text-2xl font-black leading-tight text-foreground">Profil aktivieren</h1>
          </div>
        </div>

        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <QrCode className="h-7 w-7" />
            </div>
            <div>
              <label htmlFor="activation-code" className="text-sm font-semibold text-foreground">
                Aktivierungscode
              </label>
              <Input
                id="activation-code"
                value={code}
                onChange={(event) => setCode(normalizeCode(event.target.value))}
                placeholder="20-stelliger Code"
                autoCapitalize="characters"
                autoComplete="one-time-code"
                className="mt-2 h-12 text-base font-semibold tracking-[0.12em]"
              />
            </div>
            <Button type="submit" disabled={submitting} className="h-12 w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Aktivieren
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
