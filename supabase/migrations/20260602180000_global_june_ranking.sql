-- ────────────────────────────────────────────────────────────────────────────
-- Globales Juni-2026-Ranking für die Belohnungsseite
--
-- Datenbasis: profiles.points / students.points
--   → wurden am 01.06.2026 auf 0 zurückgesetzt (full_reset_before_launch)
--   → repräsentieren damit direkt den Juni-Zeitraum 01.06.–30.06.2026
--
-- Umfang: ALLE Schüler:innen aus allen Schulen (show_in_ranking = true)
--   Typ A: QR/Code-Login  → students → classes → schools
--   Typ B: Auth-Login     → profiles (school_id FK oder school-Text)
--   Deduplication: verknüpfte Schüler (auth_user_id) zählen einmal
--
-- Sortierung: points DESC, username ASC (Tie-Breaker alphabetisch)
-- ────────────────────────────────────────────────────────────────────────────

-- ── 1. Auth-Nutzer: globales Ranking ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_global_june_student_rankings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  -- Typ A: QR/Code-Schüler (+ ggf. verknüpfte Auth-Profile)
  code_students AS (
    SELECT
      COALESCE(s.auth_user_id, s.id)                                         AS id,
      COALESCE(NULLIF(p.username, ''), s.display_name, s.first_name, '?')   AS username,
      COALESCE(p.points, s.points, 0)::integer                              AS points
    FROM public.students s
    JOIN public.classes  c  ON c.id  = s.class_id
    JOIN public.schools  sc ON sc.id = c.school_id
    LEFT JOIN public.profiles p ON p.id = s.auth_user_id
    WHERE s.deactivated_at IS NULL
      AND sc.show_in_ranking = true
  ),
  -- Typ B: reine Auth-Schüler (nicht per students-Tabelle verknüpft)
  auth_students AS (
    SELECT
      p.id,
      COALESCE(NULLIF(p.username, ''), '?')  AS username,
      COALESCE(p.points, 0)::integer         AS points
    FROM public.profiles p
    WHERE COALESCE(p.role, 'student') = 'student'
      AND NOT EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.auth_user_id = p.id AND s.deactivated_at IS NULL
      )
      -- Demo-Schulen ausschließen
      AND NOT EXISTS (
        SELECT 1 FROM public.schools sc
        WHERE lower(sc.name) = lower(COALESCE(p.school, ''))
          AND sc.show_in_ranking = false
      )
  ),
  all_students AS (
    SELECT id, username, points FROM code_students
    UNION ALL
    SELECT id, username, points FROM auth_students
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', id, 'username', username, 'points', points)
      ORDER BY points DESC, username ASC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM all_students;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_global_june_student_rankings() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_global_june_student_rankings() TO authenticated;

-- ── 2. Code/QR-Schüler: globales Ranking (Session-basiert, anon-kompatibel) ─
CREATE OR REPLACE FUNCTION public.get_global_june_student_rankings_code(
  p_device_id     text,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.active_sessions%ROWTYPE;
  v_result  jsonb;
BEGIN
  SELECT * INTO v_session
  FROM public.active_sessions
  WHERE device_id          = trim(p_device_id)
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active             = true
    AND user_type          = 'student'
    AND COALESCE(expires_at, now() + interval '1 day') > now()
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Schueler-Session');
  END IF;

  WITH
  code_students AS (
    SELECT
      COALESCE(s.auth_user_id, s.id)                                        AS id,
      COALESCE(NULLIF(p.username, ''), s.display_name, s.first_name, '?')  AS username,
      COALESCE(p.points, s.points, 0)::integer                             AS points
    FROM public.students s
    JOIN public.classes  c  ON c.id  = s.class_id
    JOIN public.schools  sc ON sc.id = c.school_id
    LEFT JOIN public.profiles p ON p.id = s.auth_user_id
    WHERE s.deactivated_at IS NULL
      AND sc.show_in_ranking = true
  ),
  auth_students AS (
    SELECT
      p.id,
      COALESCE(NULLIF(p.username, ''), '?')  AS username,
      COALESCE(p.points, 0)::integer         AS points
    FROM public.profiles p
    WHERE COALESCE(p.role, 'student') = 'student'
      AND NOT EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.auth_user_id = p.id AND s.deactivated_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.schools sc
        WHERE lower(sc.name) = lower(COALESCE(p.school, ''))
          AND sc.show_in_ranking = false
      )
  ),
  all_students AS (
    SELECT id, username, points FROM code_students
    UNION ALL
    SELECT id, username, points FROM auth_students
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', id, 'username', username, 'points', points)
      ORDER BY points DESC, username ASC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM all_students;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_global_june_student_rankings_code(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_global_june_student_rankings_code(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
