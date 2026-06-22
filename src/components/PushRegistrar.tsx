import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { initPush } from "@/lib/push";

// Registriert den Push-Token, sobald die App nativ läuft, und meldet ihn erneut,
// wenn sich die Login-Session ändert. Rendert nichts.
export function PushRegistrar() {
  const { session } = useCodeAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void initPush(session, (url) => {
      if (/^https?:\/\//.test(url)) window.open(url, "_blank");
      else navigate(url);
    });
  }, [session, navigate]);

  return null;
}
