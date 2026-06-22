-- ════════════════════════════════════════════════════════════════════════════
-- Echte OS-Push-Benachrichtigungen (Sperrbildschirm), DB-gesteuert.
--
-- Ablauf:
--   1. App registriert sich → push_subscriptions (Token + Plattform + Zielinfos)
--   2. Du trägst eine Zeile in push_messages ein
--   3. pg_cron (jede Minute) ruft die Edge-Function "send-push" auf
--   4. send-push verschickt via FCM (Android) bzw. APNs (iOS)
--
-- Neue Nachrichten brauchen KEIN App-Release – einfach Zeile in push_messages.
-- ════════════════════════════════════════════════════════════════════════════

-- ── push_subscriptions: ein Push-Token pro Gerät ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  push_token   text        NOT NULL UNIQUE,                 -- FCM-Token (Android) oder APNs-Token (iOS)
  platform     text        NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id    text,                                        -- Code-Login-Gerät (optional)
  user_id      uuid,                                        -- students.id / teachers.id bzw. auth.uid()
  user_type    text        CHECK (user_type IN ('student', 'teacher')),
  class_id     uuid,                                        -- für zielgerichteten Klassen-Versand
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_type_idx ON public.push_subscriptions (user_type);
CREATE INDEX IF NOT EXISTS push_subscriptions_class_idx     ON public.push_subscriptions (class_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;  -- Zugriff nur via RPC / service_role

-- ── push_messages: die zu versendenden Nachrichten ───────────────────────────
CREATE TABLE IF NOT EXISTS public.push_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  body            text        NOT NULL,
  target          text        NOT NULL DEFAULT 'all'
                              CHECK (target IN ('all', 'student', 'teacher', 'class', 'device')),
  target_class_id uuid,                                     -- nur bei target='class'
  target_device_id text,                                   -- nur bei target='device' (sicherer Einzelgeräte-Test)
  cta_url         text,                                     -- optionaler Deep-Link beim Tippen
  scheduled_at    timestamptz NOT NULL DEFAULT now(),       -- ab wann versenden
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  sent_count      integer,                                  -- wie viele Geräte erreicht
  error           text,                                     -- Fehlertext bei status='failed'
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);

CREATE INDEX IF NOT EXISTS push_messages_due_idx ON public.push_messages (status, scheduled_at);

ALTER TABLE public.push_messages ENABLE ROW LEVEL SECURITY;  -- nur service_role (Edge-Function) + Dashboard

-- ── RPC: register_push_subscription ──────────────────────────────────────────
-- Wird vom Client nach dem Login aufgerufen. Validiert die Session (Code-Login
-- oder Supabase-Auth) und legt den Push-Token an / aktualisiert ihn.
CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_push_token    text,
  p_platform      text,
  p_device_id     text DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_session      public.active_sessions%ROWTYPE;
  v_user_id      uuid;
  v_user_type    text;
  v_class_id     uuid;
BEGIN
  IF coalesce(trim(p_push_token), '') = '' THEN
    RETURN jsonb_build_object('error', 'push_token fehlt');
  END IF;
  IF p_platform NOT IN ('ios', 'android') THEN
    RETURN jsonb_build_object('error', 'platform muss ios oder android sein');
  END IF;

  IF v_auth_user_id IS NOT NULL THEN
    -- Supabase-Auth-User: Student-Datensatz (falls vorhanden) für Klassen-Targeting
    v_user_id := v_auth_user_id;
    SELECT 'student', s.class_id
      INTO v_user_type, v_class_id
      FROM public.students s
     WHERE s.auth_user_id = v_auth_user_id
     LIMIT 1;
  ELSE
    -- Code-Login-Session auflösen (gleiches Muster wie get_active_announcements)
    SELECT *
      INTO v_session
      FROM public.active_sessions
     WHERE device_id          = trim(coalesce(p_device_id, ''))
       AND session_token_hash = encode(extensions.digest(coalesce(p_session_token, ''), 'sha256'), 'hex')
       AND active             = true
       AND expires_at         > now()
     ORDER BY created_at DESC
     LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Keine aktive Session');
    END IF;

    v_user_id   := v_session.user_id;
    v_user_type := v_session.user_type;

    IF v_user_type = 'student' THEN
      SELECT s.class_id INTO v_class_id FROM public.students s WHERE s.id = v_session.user_id;
    END IF;
  END IF;

  INSERT INTO public.push_subscriptions
    (push_token, platform, device_id, user_id, user_type, class_id, last_seen_at)
  VALUES
    (p_push_token, p_platform, p_device_id, v_user_id, v_user_type, v_class_id, now())
  ON CONFLICT (push_token) DO UPDATE
    SET platform     = excluded.platform,
        device_id    = coalesce(excluded.device_id, public.push_subscriptions.device_id),
        user_id      = excluded.user_id,
        user_type    = excluded.user_type,
        class_id     = excluded.class_id,
        last_seen_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text) TO anon, authenticated;

-- ── Cron: jede Minute fällige Nachrichten verschicken ────────────────────────
-- Ruft die Edge-Function "send-push" nur auf, wenn wirklich etwas ansteht.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Einmalig im Dashboard nötig (NICHT in Git): den Service-Role-Key in den Vault legen, z. B.
--   SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
-- Danach läuft dieser Job automatisch.
SELECT cron.schedule(
  'send-push-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://srzhxzwxtrcotfhffhww.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  )
  WHERE EXISTS (
    SELECT 1 FROM public.push_messages
     WHERE status = 'pending' AND scheduled_at <= now()
  );
  $cron$
);

NOTIFY pgrst, 'reload schema';
