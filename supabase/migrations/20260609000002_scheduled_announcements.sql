-- Datenbankgesteuerte Scheduled Pop-ups.
-- Neue Pop-ups können jederzeit im Supabase-Dashboard eingetragen werden,
-- ohne ein neues App-Release zu benötigen.

-- ── scheduled_announcements: Konfiguration der Pop-ups ───────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_announcements (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text        NOT NULL,
  body         text        NOT NULL,
  emoji        text,                              -- großes Emoji über dem Titel (optional)
  cta_label    text,                              -- Text des CTA-Buttons (optional)
  cta_url      text,                              -- URL die der CTA-Button öffnet (optional)
  active_from  date        NOT NULL,              -- erster Tag an dem das Pop-up erscheint
  active_until date        NOT NULL,              -- letzter Tag (inklusiv)
  is_active    boolean     NOT NULL DEFAULT true, -- schneller Aus-Schalter
  target       text        NOT NULL DEFAULT 'all',-- 'all', 'student', 'teacher'
  sort_order   integer     NOT NULL DEFAULT 0,    -- Reihenfolge wenn mehrere aktiv
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_target CHECK (target IN ('all', 'student', 'teacher')),
  CONSTRAINT valid_dates  CHECK (active_until >= active_from)
);

-- ── announcement_views: wer hat welches Pop-up bereits gesehen ────────────────
CREATE TABLE IF NOT EXISTS public.announcement_views (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid        NOT NULL REFERENCES public.scheduled_announcements(id) ON DELETE CASCADE,
  user_id         uuid,        -- Supabase-Auth-User
  device_id       text,        -- Code-Login-User (per Device)
  viewed_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT views_auth_unique   UNIQUE (announcement_id, user_id),
  CONSTRAINT views_device_unique UNIQUE (announcement_id, device_id)
);

CREATE INDEX IF NOT EXISTS announcement_views_announcement_idx
  ON public.announcement_views (announcement_id);

-- ── RPC: get_active_announcements ─────────────────────────────────────────────
-- Gibt alle heute aktiven Pop-ups zurück, die der User noch nicht gesehen hat.
CREATE OR REPLACE FUNCTION public.get_active_announcements(
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
  v_user_type    text := 'auth';
  v_results      jsonb;
BEGIN
  -- Code-Login-Session auflösen
  IF v_auth_user_id IS NULL THEN
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
      RETURN jsonb_build_object('announcements', '[]'::jsonb);
    END IF;

    v_user_type := v_session.user_type; -- 'student' oder 'teacher'
  END IF;

  -- Aktive, noch nicht gesehene Pop-ups abrufen
  IF v_auth_user_id IS NOT NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',        a.id,
        'title',     a.title,
        'body',      a.body,
        'emoji',     a.emoji,
        'cta_label', a.cta_label,
        'cta_url',   a.cta_url
      ) ORDER BY a.sort_order, a.active_from
    )
    INTO v_results
    FROM public.scheduled_announcements a
    WHERE a.is_active     = true
      AND a.active_from  <= current_date
      AND a.active_until >= current_date
      AND a.target IN ('all', 'auth')
      AND NOT EXISTS (
        SELECT 1 FROM public.announcement_views v
        WHERE v.announcement_id = a.id
          AND v.user_id = v_auth_user_id
      );
  ELSE
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',        a.id,
        'title',     a.title,
        'body',      a.body,
        'emoji',     a.emoji,
        'cta_label', a.cta_label,
        'cta_url',   a.cta_url
      ) ORDER BY a.sort_order, a.active_from
    )
    INTO v_results
    FROM public.scheduled_announcements a
    WHERE a.is_active     = true
      AND a.active_from  <= current_date
      AND a.active_until >= current_date
      AND (a.target = 'all' OR a.target = v_user_type)
      AND NOT EXISTS (
        SELECT 1 FROM public.announcement_views v
        WHERE v.announcement_id = a.id
          AND v.device_id = p_device_id
      );
  END IF;

  RETURN jsonb_build_object('announcements', coalesce(v_results, '[]'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_announcements(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_active_announcements(text, text) TO anon, authenticated;

-- ── RPC: mark_announcement_seen ───────────────────────────────────────────────
-- Speichert, dass dieser User das Pop-up gesehen hat. Idempotent.
CREATE OR REPLACE FUNCTION public.mark_announcement_seen(
  p_announcement_id uuid,
  p_device_id       text DEFAULT NULL,
  p_session_token   text DEFAULT NULL
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
  IF NOT EXISTS (SELECT 1 FROM public.scheduled_announcements WHERE id = p_announcement_id) THEN
    RETURN jsonb_build_object('error', 'Announcement nicht gefunden');
  END IF;

  -- Supabase-Auth-User
  IF v_auth_user_id IS NOT NULL THEN
    INSERT INTO public.announcement_views (announcement_id, user_id)
    VALUES (p_announcement_id, v_auth_user_id)
    ON CONFLICT (announcement_id, user_id) DO NOTHING;

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

  INSERT INTO public.announcement_views (announcement_id, device_id)
  VALUES (p_announcement_id, p_device_id)
  ON CONFLICT (announcement_id, device_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_announcement_seen(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_announcement_seen(uuid, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
