// Push-Registrierung: holt den OS-Push-Token (FCM/APNs) und meldet ihn via
// register_push_subscription an Supabase. Läuft nur auf echten Geräten.
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import type { CodeSession } from "@/services/codeAuthService";

let listenersBound = false;
let lastToken: string | null = null;
let currentSession: CodeSession | null = null;

// Meldet den zuletzt erhaltenen Token mit der aktuellen Session an Supabase.
async function reportToken(): Promise<void> {
  if (!lastToken) return;
  try {
    const { error } = await (supabase.rpc as any)("register_push_subscription", {
      p_push_token:    lastToken,
      p_platform:      Capacitor.getPlatform(), // 'ios' | 'android'
      p_device_id:     currentSession?.device_id     ?? null,
      p_session_token: currentSession?.session_token ?? null,
    });
    if (error) console.warn("[PUSH] Registrierung abgelehnt:", error.message ?? error);
  } catch {
    // best-effort – ohne Token-Registrierung funktioniert die App normal weiter
  }
}

/**
 * Initialisiert Push einmalig und meldet den Token. Bei späteren Aufrufen
 * (z. B. nach einem Login) wird der bereits vorhandene Token mit der neuen
 * Session erneut gemeldet, damit user_id/class_id für Zielgruppen stimmen.
 */
export async function initPush(
  session: CodeSession | null,
  onOpenUrl?: (url: string) => void,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  currentSession = session;

  if (listenersBound) {
    void reportToken();
    return;
  }
  listenersBound = true;

  await PushNotifications.addListener("registration", (token) => {
    lastToken = token.value;
    void reportToken();
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.warn("[PUSH] registrationError:", JSON.stringify(err));
  });

  // Tippt der Nutzer auf die Benachrichtigung und es gibt einen Deep-Link → öffnen
  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = (action.notification?.data as Record<string, unknown> | undefined)?.cta_url;
    if (typeof url === "string" && url && onOpenUrl) onOpenUrl(url);
  });

  // Erlaubnis einholen (zeigt auf iOS den System-Dialog)
  const perm = await PushNotifications.checkPermissions();
  let receive = perm.receive;
  if (receive === "prompt" || receive === "prompt-with-rationale") {
    receive = (await PushNotifications.requestPermissions()).receive;
  }
  if (receive !== "granted") return;

  await PushNotifications.register(); // löst den 'registration'-Listener aus
}
