-- 14-Tage-Feedback-Prompt: Tracking-Felder + neue RPCs
-- Erweitert bestehende Tabellen; keine neue Tabelle nötig.

-- ── profiles (Supabase-Auth-User) ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feedback_prompt_shown    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_prompt_shown_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_submitted       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_submitted_at    TIMESTAMPTZ;

-- ── students (Code-Login) ─────────────────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS feedback_prompt_shown    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_prompt_shown_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_submitted       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_submitted_at    TIMESTAMPTZ;

-- ── teachers (Code-Login) ─────────────────────────────────────────────────────
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS feedback_prompt_shown    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_prompt_shown_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_submitted       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_submitted_at    TIMESTAMPTZ;

-- ── feedback_submissions: Quelle des Feedbacks ────────────────────────────────
ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS source TEXT;

-- ── submit_feedback: alte Signatur entfernen, neue mit p_source anlegen ────────
-- Alte 6-Parameter-Version droppen, damit PostgREST keine Ambiguität hat.
DROP FUNCTION IF EXISTS public.submit_feedback(text, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_message      text,
  p_rating       integer DEFAULT NULL,
  p_page         text    DEFAULT 'profile',
  p_user_agent   text    DEFAULT NULL,
  p_device_id    text    DEFAULT NULL,
  p_session_token text   DEFAULT NULL,
  p_source       text    DEFAULT NULL   -- z.B. '14_day_prompt'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_session      public.active_sessions%ROWTYPE;
  v_message      text := trim(coalesce(p_message, ''));
  v_page         text := trim(coalesce(p_page, 'profile'));
BEGIN
  IF char_length(v_message) < 3 OR char_length(v_message) > 1000 THEN
    RETURN jsonb_build_object('error', 'Feedback muss zwischen 3 und 1000 Zeichen lang sein.');
  END IF;

  IF v_page = '' OR char_length(v_page) > 80 THEN
    RETURN jsonb_build_object('error', 'Ungueltige Feedback-Seite.');
  END IF;

  IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 5) THEN
    RETURN jsonb_build_object('error', 'Bewertung muss zwischen 1 und 5 liegen.');
  END IF;

  -- ── Supabase-Auth-User ────────────────────────────────────────────────────
  IF v_auth_user_id IS NOT NULL THEN
    INSERT INTO public.feedback_submissions (user_id, message, rating, page, user_agent, source)
    VALUES (v_auth_user_id, v_message, p_rating, v_page, p_user_agent, p_source);

    -- Feedback-Status beim User setzen (verhindert erneutes 14-Tage-Pop-up)
    UPDATE public.profiles
    SET feedback_submitted       = true,
        feedback_submitted_at    = now(),
        feedback_prompt_shown    = true,
        feedback_prompt_shown_at = COALESCE(feedback_prompt_shown_at, now())
    WHERE id = v_auth_user_id;

    RETURN jsonb_build_object('ok', true);
  END IF;

  -- ── Code-Login-User ───────────────────────────────────────────────────────
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

  UPDATE public.active_sessions SET last_seen_at = now() WHERE id = v_session.id;

  INSERT INTO public.feedback_submissions (code_user_id, code_user_type, message, rating, page, user_agent, source)
  VALUES (v_session.user_id, v_session.user_type, v_message, p_rating, v_page, p_user_agent, p_source);

  -- Feedback-Status beim Code-User setzen
  IF v_session.user_type = 'student' THEN
    UPDATE public.students
    SET feedback_submitted       = true,
        feedback_submitted_at    = now(),
        feedback_prompt_shown    = true,
        feedback_prompt_shown_at = COALESCE(feedback_prompt_shown_at, now())
    WHERE id = v_session.user_id;
  ELSE
    UPDATE public.teachers
    SET feedback_submitted       = true,
        feedback_submitted_at    = now(),
        feedback_prompt_shown    = true,
        feedback_prompt_shown_at = COALESCE(feedback_prompt_shown_at, now())
    WHERE id = v_session.user_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_feedback(text, integer, text, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_feedback(text, integer, text, text, text, text, text) TO anon, authenticated;

-- ── RPC: get_feedback_prompt_status ──────────────────────────────────────────
-- Gibt zurück: { created_at, feedback_prompt_shown, feedback_submitted }
-- Frontend nutzt created_at, um zu prüfen, ob 14 Tage vergangen sind.
CREATE OR REPLACE FUNCTION public.get_feedback_prompt_status(
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
  v_created_at   timestamptz;
  v_shown        boolean;
  v_submitted    boolean;
BEGIN
  -- Supabase-Auth-User
  IF v_auth_user_id IS NOT NULL THEN
    SELECT created_at, feedback_prompt_shown, feedback_submitted
    INTO   v_created_at, v_shown, v_submitted
    FROM   public.profiles
    WHERE  id = v_auth_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Profil nicht gefunden');
    END IF;

    RETURN jsonb_build_object(
      'created_at',            v_created_at,
      'feedback_prompt_shown', v_shown,
      'feedback_submitted',    v_submitted
    );
  END IF;

  -- Code-Login-User
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

  IF v_session.user_type = 'student' THEN
    SELECT created_at, feedback_prompt_shown, feedback_submitted
    INTO   v_created_at, v_shown, v_submitted
    FROM   public.students
    WHERE  id = v_session.user_id AND active = true;
  ELSE
    SELECT created_at, feedback_prompt_shown, feedback_submitted
    INTO   v_created_at, v_shown, v_submitted
    FROM   public.teachers
    WHERE  id = v_session.user_id AND active = true;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User nicht gefunden');
  END IF;

  RETURN jsonb_build_object(
    'created_at',            v_created_at,
    'feedback_prompt_shown', v_shown,
    'feedback_submitted',    v_submitted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_feedback_prompt_status(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_feedback_prompt_status(text, text) TO anon, authenticated;

-- ── RPC: mark_feedback_prompt_shown ──────────────────────────────────────────
-- Wird aufgerufen, wenn der User das Pop-up schließt/überspringt (kein Feedback).
CREATE OR REPLACE FUNCTION public.mark_feedback_prompt_shown(
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
BEGIN
  -- Supabase-Auth-User
  IF v_auth_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET feedback_prompt_shown    = true,
        feedback_prompt_shown_at = now()
    WHERE id = v_auth_user_id;

    RETURN jsonb_build_object('ok', true);
  END IF;

  -- Code-Login-User
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

  IF v_session.user_type = 'student' THEN
    UPDATE public.students
    SET feedback_prompt_shown    = true,
        feedback_prompt_shown_at = now()
    WHERE id = v_session.user_id;
  ELSE
    UPDATE public.teachers
    SET feedback_prompt_shown    = true,
        feedback_prompt_shown_at = now()
    WHERE id = v_session.user_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_feedback_prompt_shown(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_feedback_prompt_shown(text, text) TO anon, authenticated;

-- ── Push-Notifications (manuell einzurichten) ─────────────────────────────────
-- Das Projekt nutzt aktuell kein Push-System. Für den 14-Tage-Push muss extern
-- eines der folgenden Tools eingerichtet werden:
--
--   Option A – OneSignal (empfohlen für Capacitor/iOS/Android):
--     1. OneSignal-Account anlegen, App registrieren
--     2. @capacitor-community/onesignal oder das offizielle OneSignal Capacitor SDK einbinden
--     3. In Supabase ein Scheduled Job (pg_cron) oder Edge Function anlegen:
--        SELECT cron.schedule('feedback-push', '0 9 * * *', $$
--          SELECT net.http_post(
--            'https://onesignal.com/api/v1/notifications',
--            '{"app_id":"<ID>","filters":[{"field":"tag","key":"days_since_signup","relation":">=","value":"14"}],"contents":{"de":"Wie gefällt dir boost bisher? Wir freuen uns über dein kurzes Feedback 💬"}}'::jsonb,
--            headers := '{"Authorization":"Basic <REST_KEY>","Content-Type":"application/json"}'::jsonb
--          );
--        $$);
--     4. Beim Login des Users dessen OneSignal External User ID setzen (user_id aus Supabase)
--     5. Tag "days_since_signup" täglich aktualisieren ODER ein Segment nach created_at nutzen
--
--   Option B – Firebase Cloud Messaging (FCM):
--     Analog zu Option A, aber mit @capacitor/push-notifications + FCM Admin SDK.
--
--   Option C – Supabase Edge Function + Cron:
--     Eine Edge Function "send-feedback-push" anlegen, die täglich läuft und
--     alle User mit (now() - created_at) >= 14 Tage AND feedback_prompt_shown = false
--     aus profiles/students/teachers selektiert und via Push-Provider benachrichtigt.
