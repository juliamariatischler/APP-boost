// ════════════════════════════════════════════════════════════════════════════
// send-push – verschickt fällige push_messages an alle passenden Geräte.
//   • Android → FCM HTTP v1   (OAuth2 via Service-Account)
//   • iOS     → APNs HTTP/2   (ES256-JWT via .p8-Key)
// Aufgerufen jede Minute von pg_cron (siehe Migration 20260622130000).
//
// Benötigte Secrets (supabase secrets set ...):
//   FCM_SERVICE_ACCOUNT  – komplette Service-Account-JSON (als String)
//   FCM_PROJECT_ID       – z. B. boostschule-app
//   APNS_KEY             – Inhalt der .p8-Datei (PEM)
//   APNS_KEY_ID          – z. B. Q5RS645JYY
//   APNS_TEAM_ID         – z. B. QKRDP623LF
//   APNS_TOPIC           – Bundle-ID, z. B. at.boostschule
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY werden automatisch bereitgestellt.)
// ════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FCM_HOST   = "https://fcm.googleapis.com";
// Prod zuerst, dann Sandbox – deckt App-Store/TestFlight UND Xcode-Dev-Builds ab.
const APNS_HOSTS = ["https://api.push.apple.com", "https://api.sandbox.push.apple.com"];

// ── kleine Krypto-Helfer ─────────────────────────────────────────────────────
function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

// ── FCM: OAuth2-Access-Token aus dem Service-Account holen ───────────────────
let fcmTokenCache: { token: string; exp: number } | null = null;

async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmTokenCache && fcmTokenCache.exp > now + 60) return fcmTokenCache.token;

  const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`FCM-Token-Fehler: ${JSON.stringify(json)}`);

  fcmTokenCache = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

// ── APNs: Provider-JWT (ES256) erzeugen ──────────────────────────────────────
let apnsTokenCache: { token: string; iat: number } | null = null;

async function getApnsToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (apnsTokenCache && now - apnsTokenCache.iat < 2400) return apnsTokenCache.token; // < 40 Min wiederverwenden

  const header = { alg: "ES256", kid: Deno.env.get("APNS_KEY_ID")! };
  const claims = { iss: Deno.env.get("APNS_TEAM_ID")!, iat: now };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(Deno.env.get("APNS_KEY")!),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  apnsTokenCache = { token: jwt, iat: now };
  return jwt;
}

// ── Versand pro Plattform; gibt ungültige Tokens zurück ──────────────────────
async function sendAndroid(tokens: string[], title: string, body: string, cta?: string | null) {
  const dead: string[] = [];
  if (tokens.length === 0) return dead;
  const accessToken = await getFcmAccessToken();
  const projectId   = Deno.env.get("FCM_PROJECT_ID")!;
  const url = `${FCM_HOST}/v1/projects/${projectId}/messages:send`;

  await Promise.all(tokens.map(async (token) => {
    const message: Record<string, unknown> = {
      token,
      notification: { title, body },
      android: { priority: "HIGH" },
    };
    if (cta) message.data = { cta_url: cta };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(txt)) dead.push(token);
      else console.error(`FCM ${res.status}: ${txt}`);
    }
  }));
  return dead;
}

async function sendIos(tokens: string[], title: string, body: string, cta?: string | null) {
  const dead: string[] = [];
  if (tokens.length === 0) return dead;
  const jwt   = await getApnsToken();
  const topic = Deno.env.get("APNS_TOPIC")!;

  const payload: Record<string, unknown> = {
    aps: { alert: { title, body }, sound: "default" },
  };
  if (cta) payload.cta_url = cta;
  const bodyStr = JSON.stringify(payload);
  const headers = {
    "authorization": `bearer ${jwt}`,
    "apns-topic": topic,
    "apns-push-type": "alert",
    "apns-priority": "10",
  };

  await Promise.all(tokens.map(async (token) => {
    // Prod + Sandbox durchprobieren; nur bei echtem "Unregistered" als tot markieren.
    let badOnAll = true;
    for (const host of APNS_HOSTS) {
      const res = await fetch(`${host}/3/device/${token}`, { method: "POST", headers, body: bodyStr });
      if (res.ok) { badOnAll = false; break; }
      const txt = await res.text();
      if (res.status === 410 || /Unregistered/.test(txt)) { dead.push(token); badOnAll = false; break; }
      if (/BadDeviceToken/.test(txt)) continue; // falsche Umgebung → anderen Host probieren
      console.error(`APNs ${res.status}: ${txt}`); badOnAll = false; break;
    }
    if (badOnAll) dead.push(token); // BadDeviceToken auf BEIDEN Hosts → wirklich ungültig
  }));
  return dead;
}

// ── Hauptablauf ──────────────────────────────────────────────────────────────
serve(async (req) => {
  // Nur Service-Role-Aufrufe (der Cron) dürfen auslösen – robust über die JWT-Rolle geprüft
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let role = "";
  try { role = JSON.parse(atob(token.split(".")[1] ?? "")).role; } catch { /* ungültiges Token */ }
  if (role !== "service_role") {
    return new Response("Unauthorized", { status: 401 });
  }

  // DB-Client mit Service-Role (Env bevorzugt, sonst der eingehende Service-Role-Token)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? token;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Fällige Nachrichten atomar "claimen" (pending → sending), damit nichts doppelt rausgeht
  const { data: claimed, error: claimErr } = await supabase
    .from("push_messages")
    .update({ status: "sending" })
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .select("*");

  if (claimErr) {
    console.error("claim error:", claimErr.message);
    return new Response(JSON.stringify({ error: claimErr.message }), { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; sent: number }> = [];

  for (const msg of claimed) {
    try {
      // Empfänger-Tokens je nach Zielgruppe auflösen
      let q = supabase.from("push_subscriptions").select("push_token, platform");
      if (msg.target === "student" || msg.target === "teacher") {
        q = q.eq("user_type", msg.target);
      } else if (msg.target === "class") {
        q = q.eq("class_id", msg.target_class_id);
      } else if (msg.target === "device") {
        q = q.eq("device_id", msg.target_device_id); // sicherer Einzelgeräte-Test
      }
      const { data: subs, error: subErr } = await q;
      if (subErr) throw subErr;

      const android = (subs ?? []).filter((s) => s.platform === "android").map((s) => s.push_token);
      const ios     = (subs ?? []).filter((s) => s.platform === "ios").map((s) => s.push_token);

      const [deadA, deadI] = await Promise.all([
        sendAndroid(android, msg.title, msg.body, msg.cta_url),
        sendIos(ios, msg.title, msg.body, msg.cta_url),
      ]);

      // Tote Tokens entfernen
      const dead = [...deadA, ...deadI];
      if (dead.length > 0) {
        await supabase.from("push_subscriptions").delete().in("push_token", dead);
      }

      const sent = android.length + ios.length - dead.length;
      await supabase.from("push_messages")
        .update({ status: "sent", sent_count: sent, sent_at: new Date().toISOString() })
        .eq("id", msg.id);

      results.push({ id: msg.id, sent });
    } catch (e) {
      console.error(`Nachricht ${msg.id} fehlgeschlagen:`, String(e));
      await supabase.from("push_messages")
        .update({ status: "failed", error: String(e) })
        .eq("id", msg.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
