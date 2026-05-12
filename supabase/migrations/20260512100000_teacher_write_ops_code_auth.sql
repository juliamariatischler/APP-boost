-- Code-auth variants of teacher write operations.
-- These functions authenticate via device_id + session_token instead of Supabase JWT.

-- ── Helper: verify teacher session and class access ──────────────────────────
-- Returns the teacher's user_id (from public.teachers) or NULL if unauthorised.

CREATE OR REPLACE FUNCTION public.verify_teacher_code_session(
  p_device_id text,
  p_session_token text,
  p_class_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  SELECT user_id INTO v_teacher_id
  FROM public.active_sessions
  WHERE device_id = p_device_id
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active = true
    AND user_type = 'teacher'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_teacher_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_class_access
    WHERE teacher_id = v_teacher_id
      AND class_id = p_class_id
  ) THEN
    RETURN NULL;
  END IF;

  RETURN v_teacher_id;
END;
$$;

-- ── Add student ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.teacher_add_student(
  p_device_id text,
  p_session_token text,
  p_class_id uuid,
  p_first_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
  v_student_id uuid;
  v_code text;
BEGIN
  v_teacher_id := public.verify_teacher_code_session(p_device_id, p_session_token, p_class_id);
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff');
  END IF;

  p_first_name := trim(p_first_name);
  IF p_first_name = '' THEN
    RETURN jsonb_build_object('error', 'Name fehlt');
  END IF;

  LOOP
    v_code := public.generate_activation_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.students
      WHERE activation_code_hash = public.hash_activation_code(v_code)
    );
  END LOOP;

  INSERT INTO public.students (
    class_id,
    first_name,
    display_name,
    login_code,
    active,
    activation_code_hash,
    activation_code_created_at
  )
  VALUES (
    p_class_id,
    p_first_name,
    p_first_name,
    'QR-' || encode(extensions.gen_random_bytes(16), 'hex'),
    true,
    public.hash_activation_code(v_code),
    now()
  )
  RETURNING id INTO v_student_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'activation_code', v_code
  );
END;
$$;

-- ── Generate activation code ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.teacher_generate_student_activation(
  p_device_id text,
  p_session_token text,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_teacher_id uuid;
  v_code text;
BEGIN
  SELECT class_id INTO v_class_id
  FROM public.students
  WHERE id = p_student_id
    AND deactivated_at IS NULL;

  IF v_class_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Schüler:in nicht gefunden');
  END IF;

  v_teacher_id := public.verify_teacher_code_session(p_device_id, p_session_token, v_class_id);
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff');
  END IF;

  LOOP
    v_code := public.generate_activation_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.students
      WHERE activation_code_hash = public.hash_activation_code(v_code)
    );
  END LOOP;

  UPDATE public.students
  SET activation_code_hash = public.hash_activation_code(v_code),
      activation_code_created_at = now(),
      activation_code_used_at = NULL,
      active = true
  WHERE id = p_student_id;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'activation_code', v_code
  );
END;
$$;

-- ── Reset student device ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.teacher_reset_student_device(
  p_device_id text,
  p_session_token text,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_teacher_id uuid;
BEGIN
  SELECT class_id INTO v_class_id
  FROM public.students
  WHERE id = p_student_id
    AND deactivated_at IS NULL;

  IF v_class_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Schüler:in nicht gefunden');
  END IF;

  v_teacher_id := public.verify_teacher_code_session(p_device_id, p_session_token, v_class_id);
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff');
  END IF;

  UPDATE public.students
  SET device_id = NULL
  WHERE id = p_student_id;

  UPDATE public.active_sessions
  SET active = false,
      last_seen_at = now()
  WHERE user_type = 'student'
    AND user_id = p_student_id
    AND active = true;

  INSERT INTO public.student_security_events (student_id, event_type, device_id)
  VALUES (p_student_id, 'device_reset_by_teacher', p_device_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Deactivate student ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.teacher_deactivate_student(
  p_device_id text,
  p_session_token text,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_teacher_id uuid;
BEGIN
  SELECT class_id INTO v_class_id
  FROM public.students
  WHERE id = p_student_id;

  IF v_class_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Schüler:in nicht gefunden');
  END IF;

  v_teacher_id := public.verify_teacher_code_session(p_device_id, p_session_token, v_class_id);
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff');
  END IF;

  UPDATE public.students
  SET active = false,
      deactivated_at = now(),
      device_id = NULL
  WHERE id = p_student_id;

  UPDATE public.active_sessions
  SET active = false,
      last_seen_at = now()
  WHERE user_type = 'student'
    AND user_id = p_student_id
    AND active = true;

  INSERT INTO public.student_security_events (student_id, event_type, device_id)
  VALUES (p_student_id, 'student_deactivated_by_teacher', p_device_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.verify_teacher_code_session(text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_add_student(text, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_generate_student_activation(text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_reset_student_device(text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_deactivate_student(text, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.teacher_add_student(text, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_generate_student_activation(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_reset_student_device(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_deactivate_student(text, text, uuid) TO anon, authenticated;
