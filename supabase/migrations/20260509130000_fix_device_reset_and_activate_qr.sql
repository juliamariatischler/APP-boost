-- Fix 1: Gerät resetten erzeugt automatisch einen neuen Aktivierungscode,
--         damit der Schüler/die Schülerin sofort einen frischen QR-Code erhält.
CREATE OR REPLACE FUNCTION public.teacher_reset_student_device_auth(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_code     text;
BEGIN
  SELECT class_id INTO v_class_id
  FROM public.students
  WHERE id = p_student_id
    AND deactivated_at IS NULL;

  IF v_class_id IS NULL OR NOT public.teacher_can_access_class(v_class_id) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese:n Schüler:in');
  END IF;

  -- Neuen Aktivierungscode erzeugen
  LOOP
    v_code := public.generate_activation_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.students
      WHERE activation_code_hash = public.hash_activation_code(v_code)
    );
  END LOOP;

  UPDATE public.students
  SET device_id                  = NULL,
      activation_code_hash       = public.hash_activation_code(v_code),
      activation_code_created_at = now(),
      activation_code_used_at    = NULL,
      active                     = true
  WHERE id = p_student_id;

  UPDATE public.active_sessions
  SET active       = false,
      last_seen_at = now()
  WHERE user_type = 'student'
    AND user_id   = p_student_id
    AND active    = true;

  INSERT INTO public.student_security_events (student_id, teacher_id, event_type)
  VALUES (p_student_id, auth.uid(), 'device_reset_by_teacher');

  RETURN jsonb_build_object('ok', true, 'activation_code', v_code);
END;
$$;

-- Fix 2: activate_student_qr sauber neu deployen (falls nicht vorhanden oder veraltet)
CREATE OR REPLACE FUNCTION public.activate_student_qr(
  p_code      text,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash         text;
  v_student      public.students%ROWTYPE;
  v_class        public.classes%ROWTYPE;
  v_school       public.schools%ROWTYPE;
  v_session_id   uuid;
  v_session_token text;
  v_expires_at   timestamptz := now() + interval '30 days';
BEGIN
  p_code      := upper(trim(p_code));
  p_device_id := trim(p_device_id);

  IF p_code = '' OR p_device_id = '' THEN
    RETURN jsonb_build_object('error', 'Ungueltiger Aktivierungscode');
  END IF;

  v_hash := public.hash_activation_code(p_code);

  SELECT * INTO v_student
  FROM public.students
  WHERE activation_code_hash = v_hash
  ORDER BY activation_code_created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ungueltiger Aktivierungscode');
  END IF;

  IF v_student.activation_code_used_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Dieser QR-Code wurde bereits verwendet');
  END IF;

  IF COALESCE(v_student.active, true) = false OR v_student.deactivated_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Dieses Profil ist deaktiviert');
  END IF;

  IF v_student.device_id IS NOT NULL AND v_student.device_id <> p_device_id THEN
    RETURN jsonb_build_object('error', 'Dieses Profil ist bereits mit einem anderen Geraet verbunden');
  END IF;

  v_session_token := encode(extensions.gen_random_bytes(32), 'hex');

  UPDATE public.active_sessions
  SET active       = false,
      last_seen_at = now()
  WHERE user_type = 'student'
    AND user_id   = v_student.id
    AND active    = true;

  UPDATE public.students
  SET device_id              = p_device_id,
      activated_at           = COALESCE(activated_at, now()),
      activation_code_used_at = now()
  WHERE id = v_student.id;

  INSERT INTO public.active_sessions (
    user_type, user_id, device_id, login_code, session_token_hash, expires_at
  ) VALUES (
    'student',
    v_student.id,
    p_device_id,
    'REDACTED',
    encode(extensions.digest(v_session_token, 'sha256'), 'hex'),
    v_expires_at
  )
  RETURNING id INTO v_session_id;

  SELECT * INTO v_class  FROM public.classes WHERE id = v_student.class_id;
  SELECT * INTO v_school FROM public.schools  WHERE id = v_class.school_id;

  RETURN jsonb_build_object(
    'user_type',    'student',
    'user_id',      v_student.id,
    'display_name', v_student.display_name,
    'class_id',     v_student.class_id,
    'class_name',   v_class.name,
    'school_name',  v_school.name,
    'session_id',   v_session_id,
    'session_token', v_session_token,
    'expires_at',   v_expires_at,
    'points',       COALESCE(v_student.points, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_reset_student_device_auth(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.teacher_reset_student_device_auth(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.activate_student_qr(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.activate_student_qr(text, text) TO anon, authenticated;
