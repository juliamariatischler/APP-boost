-- Mixed class rankings for students authenticated through Supabase Auth.
-- The class can contain classic profile students and QR/code students from
-- public.students. QR students that already have auth_user_id are deduplicated.

CREATE OR REPLACE FUNCTION public.get_my_class_student_rankings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_class text;
  v_school text;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Nicht angemeldet');
  END IF;

  SELECT p.class, p.school
  INTO v_class, v_school
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_class IS NULL OR v_school IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH student_rows AS (
    SELECT
      COALESCE(s.auth_user_id, s.id) AS id,
      COALESCE(NULLIF(p.username, ''), s.display_name, s.first_name) AS username,
      COALESCE(p.points, s.points, 0)::integer AS points
    FROM public.students s
    JOIN public.classes c
      ON c.id = s.class_id
    JOIN public.schools sc
      ON sc.id = c.school_id
    LEFT JOIN public.profiles p
      ON p.id = s.auth_user_id
    WHERE c.name = v_class
      AND sc.name = v_school
      AND s.deactivated_at IS NULL
  ),
  profile_rows AS (
    SELECT
      p.id,
      p.username,
      COALESCE(p.points, 0)::integer AS points
    FROM public.profiles p
    WHERE p.class = v_class
      AND p.school = v_school
      AND COALESCE(p.role, 'student') = 'student'
      AND NOT EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.auth_user_id = p.id
          AND s.deactivated_at IS NULL
      )
  ),
  combined AS (
    SELECT * FROM student_rows
    UNION ALL
    SELECT * FROM profile_rows
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'username', username,
      'points', points
    )
    ORDER BY points DESC, username ASC
  ), '[]'::jsonb)
  INTO v_result
  FROM combined;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_code_class_student_rankings(
  p_device_id     text,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session  public.active_sessions%ROWTYPE;
  v_student  public.students%ROWTYPE;
  v_class    public.classes%ROWTYPE;
  v_result   jsonb;
BEGIN
  SELECT * INTO v_session
  FROM   public.active_sessions
  WHERE  device_id          = trim(p_device_id)
    AND  session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND  active             = true
    AND  user_type          = 'student'
    AND  COALESCE(expires_at, now() + interval '1 day') > now()
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Schueler-Session');
  END IF;

  SELECT * INTO v_student
  FROM   public.students
  WHERE  id = v_session.user_id AND deactivated_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Schueler nicht gefunden'); END IF;

  SELECT * INTO v_class FROM public.classes WHERE id = v_student.class_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Klasse nicht gefunden'); END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', COALESCE(s.auth_user_id, s.id),
      'username', COALESCE(NULLIF(p.username, ''), s.display_name, s.first_name),
      'points', COALESCE(p.points, s.points, 0)
    )
    ORDER BY COALESCE(p.points, s.points, 0) DESC, COALESCE(NULLIF(p.username, ''), s.display_name, s.first_name) ASC
  ), '[]'::jsonb)
  INTO v_result
  FROM public.students s
  LEFT JOIN public.profiles p
    ON p.id = s.auth_user_id
  WHERE s.class_id = v_class.id
    AND s.deactivated_at IS NULL;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_class_student_rankings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_code_class_student_rankings(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_class_student_rankings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_code_class_student_rankings(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
