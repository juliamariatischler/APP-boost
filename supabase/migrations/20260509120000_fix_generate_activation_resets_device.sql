-- When a teacher generates a new activation QR code, reset device_id so the
-- student can activate on any device (not just the previously registered one).
CREATE OR REPLACE FUNCTION public.teacher_generate_student_activation_auth(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_code text;
BEGIN
  SELECT class_id INTO v_class_id
  FROM public.students
  WHERE id = p_student_id
    AND deactivated_at IS NULL;

  IF v_class_id IS NULL OR NOT public.teacher_can_access_class(v_class_id) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese:n Schüler:in');
  END IF;

  LOOP
    v_code := public.generate_activation_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.students
      WHERE activation_code_hash = public.hash_activation_code(v_code)
    );
  END LOOP;

  UPDATE public.students
  SET activation_code_hash       = public.hash_activation_code(v_code),
      activation_code_created_at = now(),
      activation_code_used_at    = NULL,
      device_id                  = NULL,
      active                     = true
  WHERE id = p_student_id;

  -- Deactivate any existing sessions so the old device is logged out cleanly.
  UPDATE public.active_sessions
  SET active       = false,
      last_seen_at = now()
  WHERE user_type = 'student'
    AND user_id   = p_student_id
    AND active    = true;

  RETURN jsonb_build_object(
    'student_id',      p_student_id,
    'activation_code', v_code
  );
END;
$$;
