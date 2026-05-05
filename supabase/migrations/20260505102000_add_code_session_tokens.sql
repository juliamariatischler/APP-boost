-- Replace device-id-only code login sessions with bearer-style session tokens.
-- Only token hashes are stored in the database.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.active_sessions
  ADD COLUMN IF NOT EXISTS session_token_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.active_sessions
SET active = false,
    last_seen_at = now()
WHERE active = true
  AND session_token_hash IS NULL;

UPDATE public.active_sessions
SET login_code = 'REDACTED'
WHERE login_code <> 'REDACTED';

CREATE INDEX IF NOT EXISTS idx_active_sessions_device_token
  ON public.active_sessions(device_id, session_token_hash, active);

CREATE OR REPLACE FUNCTION public.login_with_code(
  p_code text,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student students%ROWTYPE;
  v_teacher teachers%ROWTYPE;
  v_class classes%ROWTYPE;
  v_school schools%ROWTYPE;
  v_session_id uuid;
  v_session_token text;
  v_expires_at timestamptz := now() + interval '30 days';
BEGIN
  p_code := upper(trim(p_code));

  IF p_code = '' OR p_device_id = '' THEN
    RETURN jsonb_build_object('error', 'Ungueltiger Login');
  END IF;

  v_session_token := encode(extensions.gen_random_bytes(32), 'hex');

  SELECT * INTO v_student
  FROM students
  WHERE login_code = p_code AND active = true;

  IF FOUND THEN
    UPDATE active_sessions
    SET active = false
    WHERE user_id = v_student.id AND user_type = 'student' AND active = true;

    INSERT INTO active_sessions (
      user_type,
      user_id,
      device_id,
      login_code,
      session_token_hash,
      expires_at
    )
    VALUES (
      'student',
      v_student.id,
      p_device_id,
      'REDACTED',
      encode(extensions.digest(v_session_token, 'sha256'), 'hex'),
      v_expires_at
    )
    RETURNING id INTO v_session_id;

    SELECT * INTO v_class FROM classes WHERE id = v_student.class_id;
    SELECT * INTO v_school FROM schools WHERE id = v_class.school_id;

    RETURN jsonb_build_object(
      'user_type', 'student',
      'user_id', v_student.id,
      'display_name', v_student.display_name,
      'class_id', v_student.class_id,
      'class_name', v_class.name,
      'school_name', v_school.name,
      'session_id', v_session_id,
      'session_token', v_session_token,
      'device_id', p_device_id,
      'expires_at', v_expires_at
    );
  END IF;

  SELECT * INTO v_teacher
  FROM teachers
  WHERE login_code = p_code AND active = true;

  IF FOUND THEN
    UPDATE active_sessions
    SET active = false
    WHERE user_id = v_teacher.id AND user_type = 'teacher' AND active = true;

    INSERT INTO active_sessions (
      user_type,
      user_id,
      device_id,
      login_code,
      session_token_hash,
      expires_at
    )
    VALUES (
      'teacher',
      v_teacher.id,
      p_device_id,
      'REDACTED',
      encode(extensions.digest(v_session_token, 'sha256'), 'hex'),
      v_expires_at
    )
    RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
      'user_type', 'teacher',
      'user_id', v_teacher.id,
      'display_name', v_teacher.full_name,
      'session_id', v_session_id,
      'session_token', v_session_token,
      'device_id', p_device_id,
      'expires_at', v_expires_at
    );
  END IF;

  RETURN jsonb_build_object('error', 'Ungueltiger Code');
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_session(
  p_device_id text,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session active_sessions%ROWTYPE;
  v_student students%ROWTYPE;
  v_teacher teachers%ROWTYPE;
  v_class classes%ROWTYPE;
  v_school schools%ROWTYPE;
BEGIN
  IF p_device_id = '' OR p_session_token = '' THEN
    RETURN jsonb_build_object('error', 'Keine aktive Session');
  END IF;

  SELECT * INTO v_session
  FROM active_sessions
  WHERE device_id = p_device_id
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active = true
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Session');
  END IF;

  UPDATE active_sessions
  SET last_seen_at = now()
  WHERE id = v_session.id;

  IF v_session.user_type = 'student' THEN
    SELECT * INTO v_student FROM students WHERE id = v_session.user_id AND active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Schueler nicht mehr aktiv');
    END IF;

    SELECT * INTO v_class FROM classes WHERE id = v_student.class_id;
    SELECT * INTO v_school FROM schools WHERE id = v_class.school_id;

    RETURN jsonb_build_object(
      'user_type', 'student',
      'user_id', v_student.id,
      'display_name', v_student.display_name,
      'class_id', v_student.class_id,
      'class_name', v_class.name,
      'school_name', v_school.name,
      'session_id', v_session.id,
      'session_token', p_session_token,
      'device_id', p_device_id,
      'expires_at', v_session.expires_at
    );
  END IF;

  IF v_session.user_type = 'teacher' THEN
    SELECT * INTO v_teacher FROM teachers WHERE id = v_session.user_id AND active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Lehrkraft nicht mehr aktiv');
    END IF;

    RETURN jsonb_build_object(
      'user_type', 'teacher',
      'user_id', v_teacher.id,
      'display_name', v_teacher.full_name,
      'session_id', v_session.id,
      'session_token', p_session_token,
      'device_id', p_device_id,
      'expires_at', v_session.expires_at
    );
  END IF;

  RETURN jsonb_build_object('error', 'Unbekannter Benutzertyp');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_classes(
  p_device_id text,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session active_sessions%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_session
  FROM active_sessions
  WHERE device_id = p_device_id
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active = true
    AND user_type = 'teacher'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Lehrer-Session');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'class_id', c.id,
      'class_name', c.name,
      'school_name', s.name,
      'student_count', (SELECT count(*) FROM students st WHERE st.class_id = c.id AND st.active = true)
    )
    ORDER BY c.name
  ) INTO v_result
  FROM teacher_class_access tca
  JOIN classes c ON c.id = tca.class_id
  JOIN schools s ON s.id = c.school_id
  WHERE tca.teacher_id = v_session.user_id
    AND c.active = true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_class_students(
  p_device_id text,
  p_session_token text,
  p_class_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session active_sessions%ROWTYPE;
  v_access boolean;
  v_result jsonb;
BEGIN
  SELECT * INTO v_session
  FROM active_sessions
  WHERE device_id = p_device_id
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active = true
    AND user_type = 'teacher'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Lehrer-Session');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM teacher_class_access
    WHERE teacher_id = v_session.user_id AND class_id = p_class_id
  ) INTO v_access;

  IF NOT v_access THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'student_id', id,
      'display_name', display_name,
      'first_name', first_name
    )
    ORDER BY display_name
  ) INTO v_result
  FROM students
  WHERE class_id = p_class_id AND active = true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.logout_code_session(
  p_device_id text,
  p_session_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE active_sessions
  SET active = false,
      last_seen_at = now()
  WHERE device_id = p_device_id
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active = true;
END;
$$;

DROP FUNCTION IF EXISTS public.validate_session(text);
DROP FUNCTION IF EXISTS public.get_teacher_classes(text);
DROP FUNCTION IF EXISTS public.get_class_students(text, uuid);

REVOKE EXECUTE ON FUNCTION public.login_with_code(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_session(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_teacher_classes(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_class_students(text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.logout_code_session(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.login_with_code(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_session(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_classes(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_students(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logout_code_session(text, text) TO anon, authenticated;
