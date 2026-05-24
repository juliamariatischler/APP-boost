// 14-Tage-Feedback-Prompt: prüft ob das Pop-up angezeigt werden soll.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCodeAuth } from "@/contexts/CodeAuthContext";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// Auf diesen Seiten wird der Prompt nie gezeigt (Auth/Onboarding-Pfade).
const HIDDEN_PATHS = ["/", "/auth", "/login", "/reset-password", "/activate"];

interface PromptStatus {
  created_at: string;
  feedback_prompt_shown: boolean;
  feedback_submitted: boolean;
}

export interface UseFeedbackPromptResult {
  shouldShow: boolean;
  isLoading: boolean;
  /** Pop-up überspringen: markiert server-seitig als gesehen. */
  dismiss: () => Promise<void>;
  /** Nach erfolgreicher Feedback-Abgabe: schließt den Prompt lokal.
   *  Der Server wird bereits durch submit_feedback() aktualisiert. */
  close: () => void;
}

export function useFeedbackPrompt(): UseFeedbackPromptResult {
  const { session: codeSession } = useCodeAuth();
  const location = useLocation();

  const [status, setStatus] = useState<PromptStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Lokaler Override: nach Dismiss/Submit sofort ausblenden ohne Re-Fetch.
  const [dismissed, setDismissed] = useState(false);
  // Sicherstellen, dass nur einmal abgefragt wird.
  const hasFetched = useRef(false);

  useEffect(() => {
    if (HIDDEN_PATHS.includes(location.pathname)) return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    setIsLoading(true);

    const fetchStatus = async () => {
      try {
        const { data, error } = await (supabase.rpc as any)(
          "get_feedback_prompt_status",
          {
            p_device_id:     codeSession?.device_id     ?? null,
            p_session_token: codeSession?.session_token ?? null,
          },
        );

        if (!error && data && !data.error) {
          setStatus(data as PromptStatus);
        }
      } catch {
        // Netzwerkfehler → kein Prompt, kein Crash.
      } finally {
        setIsLoading(false);
      }
    };

    // Verzögerung damit die Hauptinhalte zuerst laden (besonders wichtig auf Android).
    const timer = setTimeout(() => void fetchStatus(), 3000);
    return () => clearTimeout(timer);
  }, [location.pathname, codeSession]);

  // Pop-up soll erscheinen wenn:
  // - Status geladen, nicht abgebrochen
  // - Noch nicht gesehen / noch kein Feedback abgegeben
  // - 14 Tage seit Registrierung vergangen
  const shouldShow = (() => {
    if (!status || dismissed) return false;
    if (status.feedback_prompt_shown || status.feedback_submitted) return false;
    return Date.now() - new Date(status.created_at).getTime() >= FOURTEEN_DAYS_MS;
  })();

  const close = useCallback(() => {
    setDismissed(true);
  }, []);

  const dismiss = useCallback(async () => {
    setDismissed(true);
    try {
      await (supabase.rpc as any)("mark_feedback_prompt_shown", {
        p_device_id:     codeSession?.device_id     ?? null,
        p_session_token: codeSession?.session_token ?? null,
      });
    } catch {
      // best-effort
    }
  }, [codeSession]);

  return { shouldShow, isLoading, dismiss, close };
}
