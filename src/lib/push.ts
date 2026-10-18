// Push-Registrierung: holt den OS-Push-Token (FCM/APNs) und meldet ihn via
// register_push_subscription an Supabase. Läuft nur auf echten Geräten.
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import type { CodeSession } from "@/services/codeAuthService";
import { getOrCreateDeviceId } from "@/services/codeAuthService";

export type ForegroundPush = {
  title: string;
  body: string;
  data: Record<string, unknown>;
};

let listenersBound = false;
let lastToken: string | null = null;
let currentSession: CodeSession | null = null;
let currentOnOpen: ((data: Record<string, unknown>) => void) | undefined;
let currentOnReceive: ((notification: ForegroundPush) => void) | undefined;

type PushRpcCall = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ error: { message?: string } | null }>;

// Meldet den zuletzt erhaltenen Token mit der aktuellen Session an Supabase.
async function reportToken(): Promise<void> {
  if (!lastToken) return;
  try {
    const installationId = getOrCreateDeviceId();
    const callRpc = supabase.rpc.bind(supabase) as unknown as PushRpcCall;
    const { error } = await callRpc("register_push_subscription", {
      p_push_token:    lastToken,
      p_platform:      Capacitor.getPlatform(), // 'ios' | 'android'
      p_device_id:     currentSession?.device_id     ?? null,
      p_session_token: currentSession?.session_token ?? null,
      p_installation_id: installationId,
    });
    if (error) {
      console.warn("[PUSH] Registrierung abgelehnt:", error.message ?? error);
      return;
    }
    console.info("[PUSH] Gerät registriert:", Capacitor.getPlatform(), installationId);
  } catch (error) {
    console.warn("[PUSH] Registrierung fehlgeschlagen:", error);
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
  onOpen?: (data: Record<string, unknown>) => void,
  onReceive?: (notification: ForegroundPush) => void,
  onPermissionDenied?: () => void,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  currentSession = session;
  currentOnOpen = onOpen;
  currentOnReceive = onReceive;

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
    currentOnOpen?.((action.notification?.data as Record<string, unknown> | undefined) ?? {});
  });

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    currentOnReceive?.({
      title: notification.title ?? "BOOST",
      body: notification.body ?? "",
      data: (notification.data as Record<string, unknown> | undefined) ?? {},
    });
  });

  // Erlaubnis einholen (zeigt auf iOS den System-Dialog)
  const perm = await PushNotifications.checkPermissions();
  let receive = perm.receive;
  if (receive === "prompt" || receive === "prompt-with-rationale") {
    receive = (await PushNotifications.requestPermissions()).receive;
  }
  if (receive !== "granted") {
    onPermissionDenied?.();
    return;
  }

  await PushNotifications.register(); // löst den 'registration'-Listener aus
}

export async function clearPushIdentity(session: CodeSession): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const callRpc = supabase.rpc.bind(supabase) as unknown as PushRpcCall;
  await callRpc("clear_push_subscription_identity", {
    p_installation_id: getOrCreateDeviceId(),
    p_device_id: session.device_id,
    p_session_token: session.session_token,
  });
}
