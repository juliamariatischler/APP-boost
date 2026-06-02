import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCodeAuth } from "@/contexts/CodeAuthContext";

const HIDDEN_PATHS = ["/", "/auth", "/login", "/reset-password", "/activate"];

export interface Announcement {
  id: string;
  title: string;
  body: string;
  emoji?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
}

export function useAnnouncements() {
  const { session: codeSession } = useCodeAuth();
  const location = useLocation();
  const [queue, setQueue] = useState<Announcement[]>([]);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (HIDDEN_PATHS.includes(location.pathname)) return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await (supabase.rpc as any)(
          "get_active_announcements",
          {
            p_device_id:     codeSession?.device_id     ?? null,
            p_session_token: codeSession?.session_token ?? null,
          },
        );
        if (!error && Array.isArray(data?.announcements)) {
          setQueue(data.announcements as Announcement[]);
        }
      } catch {
        // silent fail – kein Pop-up bei Netzwerkfehler
      }
    };

    const timer = setTimeout(() => void fetchAnnouncements(), 3500);
    return () => clearTimeout(timer);
  }, [location.pathname, codeSession]);

  const current = queue[0] ?? null;

  const dismiss = useCallback(
    async (id: string) => {
      setQueue((q) => q.filter((a) => a.id !== id));
      try {
        await (supabase.rpc as any)("mark_announcement_seen", {
          p_announcement_id: id,
          p_device_id:       codeSession?.device_id     ?? null,
          p_session_token:   codeSession?.session_token ?? null,
        });
      } catch {
        // best-effort
      }
    },
    [codeSession],
  );

  return { current, dismiss };
}
