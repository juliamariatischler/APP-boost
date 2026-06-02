// Einmaliger Belohnungs-Hinweis: erscheint ab 04.06.2026 genau einmal pro Kind.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCodeAuth } from "@/contexts/CodeAuthContext";

// Ab diesem Datum wird der Hinweis angezeigt.
const SHOW_FROM = new Date("2026-06-04T00:00:00");

// Auf diesen Pfaden wird der Prompt nie gezeigt.
const HIDDEN_PATHS = ["/", "/auth", "/login", "/reset-password", "/activate", "/rewards"];

export interface UseRewardsHintResult {
  shouldShow: boolean;
  dismiss: () => Promise<void>;
}

export function useRewardsHint(): UseRewardsHintResult {
  const { session: codeSession } = useCodeAuth();
  const location = useLocation();

  const [shown, setShown] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (HIDDEN_PATHS.includes(location.pathname)) return;
    if (hasFetched.current) return;
    if (Date.now() < SHOW_FROM.getTime()) return;
    hasFetched.current = true;

    const fetchStatus = async () => {
      try {
        const { data, error } = await (supabase.rpc as any)(
          "get_rewards_hint_status",
          {
            p_device_id:     codeSession?.device_id     ?? null,
            p_session_token: codeSession?.session_token ?? null,
          },
        );
        if (!error && data && !data.error) {
          setShown((data as { rewards_hint_shown: boolean }).rewards_hint_shown);
        }
      } catch {
        // Netzwerkfehler → kein Prompt, kein Crash.
      }
    };

    // Verzögerung damit Hauptinhalte zuerst laden.
    const timer = setTimeout(() => void fetchStatus(), 3500);
    return () => clearTimeout(timer);
  }, [location.pathname, codeSession]);

  const shouldShow =
    shown === false &&
    !dismissed &&
    !HIDDEN_PATHS.includes(location.pathname) &&
    Date.now() >= SHOW_FROM.getTime();

  const dismiss = useCallback(async () => {
    setDismissed(true);
    try {
      await (supabase.rpc as any)("mark_rewards_hint_shown", {
        p_device_id:     codeSession?.device_id     ?? null,
        p_session_token: codeSession?.session_token ?? null,
      });
    } catch {
      // best-effort
    }
  }, [codeSession]);

  return { shouldShow, dismiss };
}
