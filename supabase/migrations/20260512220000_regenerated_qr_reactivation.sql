-- Regenerated QR codes must be usable again, especially for device changes.
-- A new QR keeps the management student row but allows a fresh Auth user to
-- take over. Existing daily progress is moved from the previous Auth user.

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

CREATE OR REPLACE FUNCTION public.prepare_student_qr_registration(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_student public.students%ROWTYPE;
  v_class public.classes%ROWTYPE;
  v_school public.schools%ROWTYPE;
BEGIN
  p_code := upper(trim(p_code));

  IF p_code = '' THEN
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

  SELECT * INTO v_class FROM public.classes WHERE id = v_student.class_id;
  SELECT * INTO v_school FROM public.schools WHERE id = v_class.school_id;

  RETURN jsonb_build_object(
    'student_id', v_student.id,
    'display_name', v_student.display_name,
    'first_name', v_student.first_name,
    'class_id', v_class.id,
    'class_name', v_class.name,
    'school_name', v_school.name,
    'email', 'qr-' || replace(v_student.id::text, '-', '') || '-' || substr(v_hash, 1, 12) || '@qr.boost-schule.app'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_student_qr_registration(
  p_code text,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_previous_auth_user_id uuid;
  v_hash text;
  v_student public.students%ROWTYPE;
  v_class public.classes%ROWTYPE;
  v_school public.schools%ROWTYPE;
BEGIN
  p_code := upper(trim(p_code));
  p_device_id := trim(p_device_id);

  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Nicht angemeldet');
  END IF;

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

  IF v_student.activation_code_used_at IS NOT NULL
     AND v_student.auth_user_id IS DISTINCT FROM v_auth_user_id THEN
    RETURN jsonb_build_object('error', 'Dieser QR-Code wurde bereits verwendet');
  END IF;

  IF COALESCE(v_student.active, true) = false OR v_student.deactivated_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Dieses Profil ist deaktiviert');
  END IF;

  v_previous_auth_user_id := v_student.auth_user_id;

  SELECT * INTO v_class FROM public.classes WHERE id = v_student.class_id;
  SELECT * INTO v_school FROM public.schools WHERE id = v_class.school_id;

  UPDATE public.students
  SET auth_user_id = v_auth_user_id,
      device_id = p_device_id,
      activated_at = COALESCE(activated_at, now()),
      activation_code_used_at = COALESCE(activation_code_used_at, now())
  WHERE id = v_student.id;

  UPDATE public.profiles
  SET username = COALESCE(NULLIF(username, ''), v_student.display_name),
      school = v_school.name,
      class = v_class.name,
      role = 'student',
      age = COALESCE(age, 10)
  WHERE id = v_auth_user_id;

  IF v_previous_auth_user_id IS NOT NULL AND v_previous_auth_user_id <> v_auth_user_id THEN
    UPDATE public.profiles
    SET school = 'Archiv',
        class = 'Altes Gerät'
    WHERE id = v_previous_auth_user_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_auth_user_id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_previous_auth_user_id IS NOT NULL AND v_previous_auth_user_id <> v_auth_user_id THEN
    DELETE FROM public.teacher_student_assignments
    WHERE student_id = v_previous_auth_user_id;
  END IF;

  INSERT INTO public.teacher_student_assignments (teacher_id, student_id, created_by)
  SELECT v_student.created_by_auth_teacher_id, v_auth_user_id, v_student.created_by_auth_teacher_id
  WHERE v_student.created_by_auth_teacher_id IS NOT NULL
  ON CONFLICT (teacher_id, student_id) DO NOTHING;

  INSERT INTO public.teacher_student_assignments (teacher_id, student_id, created_by)
  SELECT p.id, v_auth_user_id, p.id
  FROM public.profiles p
  WHERE p.role = 'teacher'
    AND p.school = v_school.name
    AND (p.class = v_class.name OR p.class = 'Lehrkraft' OR p.class = 'Sport')
  ON CONFLICT (teacher_id, student_id) DO NOTHING;

  INSERT INTO public.daily_results (
    user_id,
    date,
    push_ups,
    squats,
    planks,
    sit_ups,
    jumping_jacks,
    steps,
    steps_tracking_active
  )
  SELECT
    v_auth_user_id,
    date,
    push_ups,
    squats,
    planks,
    sit_ups,
    jumping_jacks,
    steps,
    steps_tracking_active
  FROM public.daily_results
  WHERE user_id IN (v_student.id, v_previous_auth_user_id)
    AND user_id IS DISTINCT FROM v_auth_user_id
  ON CONFLICT (user_id, date) DO UPDATE
  SET push_ups = GREATEST(COALESCE(public.daily_results.push_ups, 0), COALESCE(EXCLUDED.push_ups, 0)),
      squats = GREATEST(COALESCE(public.daily_results.squats, 0), COALESCE(EXCLUDED.squats, 0)),
      planks = GREATEST(COALESCE(public.daily_results.planks, 0), COALESCE(EXCLUDED.planks, 0)),
      sit_ups = GREATEST(COALESCE(public.daily_results.sit_ups, 0), COALESCE(EXCLUDED.sit_ups, 0)),
      jumping_jacks = GREATEST(COALESCE(public.daily_results.jumping_jacks, 0), COALESCE(EXCLUDED.jumping_jacks, 0)),
      steps = GREATEST(COALESCE(public.daily_results.steps, 0), COALESCE(EXCLUDED.steps, 0)),
      steps_tracking_active = COALESCE(public.daily_results.steps_tracking_active, false) OR COALESCE(EXCLUDED.steps_tracking_active, false);

  DELETE FROM public.daily_results
  WHERE user_id IN (v_student.id, v_previous_auth_user_id)
    AND user_id IS DISTINCT FROM v_auth_user_id;

  RETURN jsonb_build_object(
    'user_type', 'student',
    'user_id', v_auth_user_id,
    'student_id', v_student.id,
    'display_name', v_student.display_name,
    'class_id', v_class.id,
    'class_name', v_class.name,
    'school_name', v_school.name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_generate_student_activation_auth(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_generate_student_activation(text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prepare_student_qr_registration(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_student_qr_registration(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.teacher_generate_student_activation_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_generate_student_activation(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_student_qr_registration(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_student_qr_registration(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
