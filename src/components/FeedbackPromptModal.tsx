// 14-Tage-Feedback-Pop-up: erscheint genau einmal nach 14 Tagen Nutzung.
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { useFeedbackPrompt } from "@/hooks/useFeedbackPrompt";

// Auf diesen Pfaden wird das Modal nie gezeigt (konsistent mit dem Hook).
const HIDDEN_PATHS = ["/", "/auth", "/login", "/reset-password", "/activate"];

export function FeedbackPromptModal() {
  const { session: codeSession } = useCodeAuth();
  const location = useLocation();
  const { shouldShow, dismiss, close } = useFeedbackPrompt();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Dialog öffnen, sobald die Bedingungen erfüllt sind.
  useEffect(() => {
    if (shouldShow && !HIDDEN_PATHS.includes(location.pathname)) {
      setOpen(true);
    }
  }, [shouldShow, location.pathname]);

  const handleDismiss = async () => {
    setOpen(false);
    await dismiss();
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      toast.error("Bitte schreib kurz, was du denkst (mind. 3 Zeichen).");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await (supabase.rpc as any)("submit_feedback", {
        p_message:       trimmed,
        p_rating:        rating,
        p_page:          "14_day_prompt",
        p_source:        "14_day_prompt",
        p_user_agent:    typeof navigator !== "undefined" ? navigator.userAgent : null,
        p_device_id:     codeSession?.device_id     ?? null,
        p_session_token: codeSession?.session_token ?? null,
      });

      if (error) throw error;
      const result = data as Record<string, unknown> | null;
      if (result?.error) throw new Error(String(result.error));

      setOpen(false);
      close(); // lokaler State: kein Re-Render nötig, Server hat bereits aktualisiert
      toast.success("Danke für dein Feedback! 💬");
    } catch {
      toast.error("Feedback konnte nicht gespeichert werden.");
    } finally {
      setSending(false);
    }
  };

  const ratingLabel =
    rating === 1 ? "Gefällt mir wenig" :
    rating === 5 ? "Mega App 🔥" :
    `${rating} von 5`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !sending) void handleDismiss(); }}>
      <DialogContent className="mx-4 max-w-sm rounded-[28px] border-0 p-0 shadow-[0_32px_64px_rgba(0,0,0,0.18)]">
        <div className="p-6">
          <DialogHeader className="mb-5 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              14 Tage BOOST
            </p>
            <DialogTitle className="mt-1 text-[1.5rem] font-black leading-tight tracking-tight text-foreground">
              Wie gefällt dir boost bisher?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Dein Feedback hilft uns, boost besser zu machen.
            </DialogDescription>
          </DialogHeader>

          {/* Sterne-Bewertung */}
          <div className="mb-2 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="transition-transform active:scale-90"
                aria-label={`${star} Sterne`}
              >
                <Star
                  className={`h-9 w-9 transition-colors ${
                    star <= rating
                      ? "fill-primary text-primary"
                      : "fill-transparent text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
            {ratingLabel}
          </p>

          <Textarea
            placeholder="Was denkst du? (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mb-4 min-h-[90px] resize-none rounded-2xl border-black/8 bg-muted/40"
            maxLength={1000}
            disabled={sending}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={() => void handleDismiss()}
              disabled={sending}
            >
              Überspringen
            </Button>
            <Button
              className="flex-1 rounded-2xl"
              onClick={() => void handleSubmit()}
              disabled={sending}
            >
              {sending ? "Senden..." : "Feedback senden"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
