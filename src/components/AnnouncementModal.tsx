import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
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

// App-Store-Links für den plattform-schlauen "Aktualisieren"-Button.
const STORE_LINKS = {
  android: "https://play.google.com/store/apps/details?id=at.boostschule",
  ios: "https://apps.apple.com/at/app/boostschule-fit-fun/id6765766658",
} as const;

// Löst eine cta_url auf. Spezialfall: beginnt sie mit "store" (optional gefolgt
// von ":<web-fallback>"), wird je nach Plattform automatisch der richtige Store
// geöffnet. Andernfalls wird die URL unverändert verwendet.
function resolveCtaUrl(ctaUrl: string): string {
  const raw = ctaUrl.trim();
  const lower = raw.toLowerCase();
  if (lower !== "store" && !lower.startsWith("store:")) {
    return raw;
  }

  const fallback = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1).trim() : "";
  const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
  if (platform === "android") return STORE_LINKS.android;
  if (platform === "ios") return STORE_LINKS.ios;
  return fallback || STORE_LINKS.android; // Web-Fallback
}

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
      const url = resolveCtaUrl(current.cta_url);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
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
