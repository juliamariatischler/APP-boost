import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { initPush } from "@/lib/push";
import { toast } from "sonner";
import { isExternalPushAction, pushActionUrl, resolvePushAction } from "@/lib/pushActions";
import { Capacitor } from "@capacitor/core";

// Registriert den Push-Token, sobald die App nativ läuft, und meldet ihn erneut,
// wenn sich die Login-Session ändert. Rendert nichts.
export function PushRegistrar() {
  const { session } = useCodeAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const openAction = (data: Record<string, unknown>) => {
      const action = resolvePushAction(data);
      const url = pushActionUrl(action);
      if (!url) return;
      if (isExternalPushAction(action)) {
        if (!window.confirm("Möchtest du BOOST verlassen und den externen Link öffnen?")) return;
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        navigate(url);
      }
    };

    void initPush(
      session,
      openAction,
      (notification) => {
        const action = resolvePushAction(notification.data);
        const url = pushActionUrl(action);
        toast(notification.title, {
          description: notification.body,
          duration: 10_000,
          action: url ? { label: "Öffnen", onClick: () => openAction(notification.data) } : undefined,
        });
      },
      () => {
        toast.warning("Mitteilungen sind deaktiviert", {
          description: "Aktiviere Mitteilungen in den Geräteeinstellungen, um nichts zu verpassen.",
          action: Capacitor.getPlatform() === "ios"
            ? { label: "Einstellungen", onClick: () => { window.location.href = "app-settings:"; } }
            : undefined,
        });
      },
    );
  }, [session, navigate]);

  return null;
}
