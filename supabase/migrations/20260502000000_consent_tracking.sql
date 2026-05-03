-- ============================================================
-- Consent tracking for DSGVO Article 8 (parental consent)
-- Adds consent_given_at to active_sessions so we can audit
-- that a user accepted the privacy/parental consent screen
-- before each login session.
-- ============================================================

ALTER TABLE public.active_sessions
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz;

-- ============================================================
-- RPC: login_with_code (updated to accept consent timestamp)
-- ============================================================
CREATE OR REPLACE FUNCTION public.login_with_code(
  p_code          text,
  p_device_id     text,
  p_consent_ts    timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student   students%ROWTYPE;
  v_teacher   teachers%ROWTYPE;
  v_class     classes%ROWTYPE;
  v_school    schools%ROWTYPE;
  v_session_id uuid;
BEGIN
  p_code := upper(trim(p_code));

  -- ── Check students ─────────────────────────────────────
  SELECT * INTO v_student
  FROM students
  WHERE login_code = p_code AND active = true;

  IF FOUND THEN
    UPDATE active_sessions
    SET active = false
    WHERE user_id = v_student.id AND user_type = 'student' AND active = true;

    INSERT INTO active_sessions (user_type, user_id, device_id, login_code, consent_given_at)
    VALUES ('student', v_student.id, p_device_id, p_code, p_consent_ts)
    RETURNING id INTO v_session_id;

    SELECT * INTO v_class  FROM classes WHERE id = v_student.class_id;
    SELECT * INTO v_school FROM schools WHERE id = v_class.school_id;

    RETURN jsonb_build_object(
      'user_type',    'student',
      'user_id',      v_student.id,
      'display_name', v_student.display_name,
      'class_id',     v_student.class_id,
      'class_name',   v_class.name,
      'school_name',  v_school.name,
      'session_id',   v_session_id,
      'device_id',    p_device_id
    );
  END IF;

  -- ── Check teachers ─────────────────────────────────────
  SELECT * INTO v_teacher
  FROM teachers
  WHERE login_code = p_code AND active = true;

  IF FOUND THEN
    UPDATE active_sessions
    SET active = false
    WHERE user_id = v_teacher.id AND user_type = 'teacher' AND active = true;

    INSERT INTO active_sessions (user_type, user_id, device_id, login_code, consent_given_at)
    VALUES ('teacher', v_teacher.id, p_device_id, p_code, p_consent_ts)
    RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
      'user_type',    'teacher',
      'user_id',      v_teacher.id,
      'display_name', v_teacher.full_name,
      'session_id',   v_session_id,
      'device_id',    p_device_id
    );
  END IF;

  RETURN jsonb_build_object('error', 'Ungültiger Code');
END;
$$;
