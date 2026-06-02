-- Einmaliger Belohnungs-Hinweis-Prompt: ab 09.06.2026 einmalig für jedes Kind.
-- Tracking-Felder + RPCs analog zum 14-Tage-Feedback-Prompt.

-- ── profiles (Supabase-Auth-User) ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rewards_hint_shown    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rewards_hint_shown_at TIMESTAMPTZ;

-- ── students (Code-Login) ─────────────────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS rewards_hint_shown    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rewards_hint_shown_at TIMESTAMPTZ;

-- ── RPC: get_rewards_hint_status ──────────────────────────────────────────────
-- Gibt zurück: { rewards_hint_shown }
CREATE OR REPLACE FUNCTION public.get_rewards_hint_status(
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
  v_shown        boolean;
BEGIN
  -- Supabase-Auth-User
  IF v_auth_user_id IS NOT NULL THEN
    SELECT rewards_hint_shown
    INTO   v_shown
    FROM   public.profiles
    WHERE  id = v_auth_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Profil nicht gefunden');
    END IF;

    RETURN jsonb_build_object('rewards_hint_shown', v_shown);
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

  -- Nur für Students (Lehrer brauchen keinen Belohnungs-Hinweis)
  IF v_session.user_type = 'student' THEN
    SELECT rewards_hint_shown
    INTO   v_shown
    FROM   public.students
    WHERE  id = v_session.user_id AND active = true;
  ELSE
    -- Lehrer: Prompt nie anzeigen
    RETURN jsonb_build_object('rewards_hint_shown', true);
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User nicht gefunden');
  END IF;

  RETURN jsonb_build_object('rewards_hint_shown', v_shown);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rewards_hint_status(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rewards_hint_status(text, text) TO anon, authenticated;

-- ── RPC: mark_rewards_hint_shown ─────────────────────────────────────────────
-- Wird aufgerufen, wenn das Pop-up geschlossen wird.
CREATE OR REPLACE FUNCTION public.mark_rewards_hint_shown(
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
    SET rewards_hint_shown    = true,
        rewards_hint_shown_at = now()
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
    SET rewards_hint_shown    = true,
        rewards_hint_shown_at = now()
    WHERE id = v_session.user_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_rewards_hint_shown(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_rewards_hint_shown(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
