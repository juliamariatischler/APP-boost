import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, QrCode, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCodeAuth } from "@/contexts/CodeAuthContext";

const normalizeCode = (value: string) => value.replace(/\s+/g, "").toUpperCase();

export default function Activate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activate } = useCodeAuth();
  const [hasQrCode] = useState(() => Boolean(normalizeCode(searchParams.get("code") || "")));
  const [submitting, setSubmitting] = useState(false);

  const submitActivation = async (activationCode: string) => {
    const normalized = normalizeCode(activationCode);
    if (!normalized) {
      toast.error("Bitte scanne den QR-Code deiner Lehrkraft.");
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
    window.history.replaceState(null, "", "/activate");
    void submitActivation(initialCode);
    // The initial QR scan should run once for the URL code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
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
          <div className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <QrCode className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-black text-foreground">
                {hasQrCode ? "QR-Code wird geprüft..." : "QR-Code erforderlich"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasQrCode
                  ? "Der QR-Code wird im Hintergrund gelesen. Du musst nichts eintippen."
                  : "Bitte öffne diese Seite über den QR-Code deiner Lehrkraft oder scanne den QR-Code direkt in der BOOST App."}
              </p>
            </div>
            <Button type="button" disabled className="h-12 w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              {submitting ? "Aktiviere..." : "QR-Code scannen"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
