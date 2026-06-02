// Einmaliger Belohnungs-Hinweis: erscheint ab 04.06.2026 genau einmal pro Kind.
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Gift } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRewardsHint } from "@/hooks/useRewardsHint";

const HIDDEN_PATHS = ["/", "/auth", "/login", "/reset-password", "/activate", "/rewards"];

export function RewardsHintModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { shouldShow, dismiss } = useRewardsHint();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldShow && !HIDDEN_PATHS.includes(location.pathname)) {
      setOpen(true);
    }
  }, [shouldShow, location.pathname]);

  const handleGoToRewards = async () => {
    setOpen(false);
    await dismiss();
    navigate("/rewards");
  };

  const handleDismiss = async () => {
    setOpen(false);
    await dismiss();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void handleDismiss(); }}>
      <DialogContent className="mx-4 max-w-sm rounded-[28px] border-0 p-0 shadow-[0_32px_64px_rgba(0,0,0,0.18)] overflow-hidden">
        {/* Farbiger Header-Banner */}
        <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-6 pt-8 pb-6 text-white">
          {/* Dekorative Kreise im Hintergrund */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10" />

          {/* Icon */}
          <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
            <Gift className="h-7 w-7 text-white" />
          </div>

          <DialogHeader className="text-left">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white/70">
              Neu verfügbar
            </p>
            <DialogTitle className="mt-0.5 text-[1.45rem] font-black leading-tight tracking-tight text-white">
              Deine Belohnungen warten!
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-white/80">
              Unter <span className="font-semibold text-white">Profil → Belohnungen</span> kannst du sehen, was du dir mit deinen Punkten verdient hast.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Unterer Bereich */}
        <div className="px-6 py-5">
          {/* Illustration / Hinweis-Karte */}
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3">
            <span className="text-2xl">🏆</span>
            <p className="text-sm text-muted-foreground leading-snug">
              Sammle Punkte, erreiche Ziele und löse deine <span className="font-semibold text-foreground">Belohnungen</span> ein!
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2.5">
            <Button
              className="w-full rounded-2xl py-5 text-base font-bold shadow-md"
              onClick={() => void handleGoToRewards()}
            >
              Belohnungen ansehen
            </Button>
            <Button
              variant="ghost"
              className="w-full rounded-2xl text-muted-foreground"
              onClick={() => void handleDismiss()}
            >
              Später
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
