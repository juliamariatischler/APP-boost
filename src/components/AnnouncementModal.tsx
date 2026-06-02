import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAnnouncements } from "@/hooks/useAnnouncements";

const HIDDEN_PATHS = ["/", "/auth", "/login", "/reset-password", "/activate"];

export function AnnouncementModal() {
  const location = useLocation();
  const { current, dismiss } = useAnnouncements();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (current && !HIDDEN_PATHS.includes(location.pathname)) {
      setOpen(true);
    }
  }, [current, location.pathname]);

  if (!current) return null;

  const handleClose = async () => {
    setOpen(false);
    await dismiss(current.id);
  };

  const handleCta = async () => {
    if (current.cta_url) {
      window.open(current.cta_url, "_blank", "noopener,noreferrer");
    }
    await handleClose();
  };

  const hasCta = !!(current.cta_label && current.cta_url);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void handleClose(); }}>
      <DialogContent className="mx-4 max-w-sm rounded-[28px] border-0 p-0 shadow-[0_32px_64px_rgba(0,0,0,0.18)]">
        <div className="p-6">
          {current.emoji && (
            <div className="mb-3 text-center text-5xl">{current.emoji}</div>
          )}
          <DialogHeader className="mb-5 text-left">
            <DialogTitle className="text-[1.5rem] font-black leading-tight tracking-tight text-foreground">
              {current.title}
            </DialogTitle>
            <DialogDescription className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
              {current.body}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3">
            {hasCta ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl"
                  onClick={() => void handleClose()}
                >
                  Schließen
                </Button>
                <Button
                  className="flex-1 rounded-2xl"
                  onClick={() => void handleCta()}
                >
                  {current.cta_label}
                </Button>
              </>
            ) : (
              <Button
                className="w-full rounded-2xl"
                onClick={() => void handleClose()}
              >
                Verstanden
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
