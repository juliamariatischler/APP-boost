-- ============================================================
-- Wochenvideo-Belohnung auch für Code-Auth-Schüler absichern
-- ============================================================
-- Vorher: claim_weekly_video_reward / get_weekly_video_status liefen nur über
-- auth.uid() und waren nur an Rolle `authenticated` vergeben. Code-Auth-Schüler
-- (anon-Rolle) konnten sie nicht aufrufen → Abschluss landete nur in localStorage
-- → durch Löschen der App-Daten beliebig oft wiederholbar UND es wurden gar keine
-- Blitze serverseitig gutgeschrieben.
--
-- Jetzt: beide RPCs akzeptieren p_device_id + p_session_token (gleiches Muster wie
-- record_nfc_scan). Die Identität wird serverseitig über active_sessions aufgelöst.
-- weekly_video_completions PK (user_id, week_key) bleibt der harte Idempotenz-Anker:
-- exakt EINE Belohnung pro Kind pro Woche, nicht durch App-Daten-Löschen umgehbar.
-- ============================================================

-- ── 1. FK auf profiles entfernen ─────────────────────────────────────────────
-- Code-Auth-Schüler liegen in public.students, nicht in public.profiles. Beide IDs
-- sind uuid; ohne FK kann die Completion-Zeile für beide Auth-Typen gespeichert
-- werden. Die Eindeutigkeit garantiert weiterhin der Primärschlüssel.
ALTER TABLE public.weekly_video_completions
  DROP CONSTRAINT IF EXISTS weekly_video_completions_user_id_fkey;

-- ── 2. claim_weekly_video_reward neu (mit Code-Auth-Unterstützung) ───────────
DROP FUNCTION IF EXISTS public.claim_weekly_video_reward(text, integer);

CREATE OR REPLACE FUNCTION public.claim_weekly_video_reward(
  p_week_key      text,
  p_points        integer DEFAULT 20,
  p_device_id     text DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid;
  v_is_code_auth boolean := false;
  v_week_key     text := trim(coalesce(p_week_key, ''));
  v_points       integer := p_points;
  v_source_key   text;
  v_row_count    integer := 0;
BEGIN
  -- Identität auflösen: zuerst Code-Auth (device_id + session_token), dann Supabase-Auth
  IF p_device_id IS NOT NULL AND p_session_token IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.active_sessions
    WHERE device_id = p_device_id
      AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      AND active = true
      AND COALESCE(expires_at, now() + interval '1 day') > now()
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_user_id IS NOT NULL THEN
      v_is_code_auth := true;
    END IF;
  END IF;

  IF v_user_id IS NULL AND auth.uid() IS NOT NULL THEN
    v_user_id := auth.uid();
    v_is_code_auth := false;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  IF v_week_key = '' THEN
    RAISE EXCEPTION 'Invalid week_key';
  END IF;

  IF v_points < 1 OR v_points > 50 THEN
    RAISE EXCEPTION 'Invalid points value';
  END IF;

  -- Atomarer Idempotenz-Anker: schlägt der Insert wegen PK-Konflikt fehl,
  -- wurde die Belohnung diese Woche bereits abgeholt.
  INSERT INTO public.weekly_video_completions (user_id, week_key, points)
  VALUES (v_user_id, v_week_key, v_points)
  ON CONFLICT (user_id, week_key) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count = 0 THEN
    RETURN jsonb_build_object('awarded', false, 'already_claimed', true, 'points', 0);
  END IF;

  -- Punkte gutschreiben. Code-Auth → students.points (wie NFC-Route, ohne point_awards
  -- wegen dessen FK auf profiles). Supabase-Auth → profiles.points + point_awards.
  IF v_is_code_auth THEN
    UPDATE public.students
    SET points = COALESCE(points, 0) + v_points
    WHERE id = v_user_id;
  ELSE
    v_source_key := 'weekly_video_' || v_week_key;

    UPDATE public.profiles
    SET points = COALESCE(points, 0) + v_points,
        updated_at = now()
    WHERE id = v_user_id;

    INSERT INTO public.point_awards (user_id, points, source)
    SELECT v_user_id, v_points, v_source_key
    WHERE NOT EXISTS (
      SELECT 1 FROM public.point_awards
      WHERE user_id = v_user_id AND source = v_source_key
    );
  END IF;

  RETURN jsonb_build_object('awarded', true, 'already_claimed', false, 'points', v_points);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_weekly_video_reward(text, integer, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_weekly_video_reward(text, integer, text, text) TO anon, authenticated;

-- ── 3. get_weekly_video_status neu (mit Code-Auth-Unterstützung) ─────────────
DROP FUNCTION IF EXISTS public.get_weekly_video_status(text);

CREATE OR REPLACE FUNCTION public.get_weekly_video_status(
  p_week_key      text,
  p_device_id     text DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_week_key text := trim(coalesce(p_week_key, ''));
  v_claimed  boolean;
BEGIN
  IF p_device_id IS NOT NULL AND p_session_token IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.active_sessions
    WHERE device_id = p_device_id
      AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      AND active = true
      AND COALESCE(expires_at, now() + interval '1 day') > now()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL AND auth.uid() IS NOT NULL THEN
    v_user_id := auth.uid();
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('claimed', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.weekly_video_completions
    WHERE user_id = v_user_id AND week_key = v_week_key
  ) INTO v_claimed;

  RETURN jsonb_build_object('claimed', v_claimed);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_weekly_video_status(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_weekly_video_status(text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
