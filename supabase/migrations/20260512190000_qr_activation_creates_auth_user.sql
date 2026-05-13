-- QR activation now completes the normal Supabase Auth registration flow.
-- The app first reads the activation context, signs up a real auth user, then
-- finalizes the QR activation while authenticated as that user.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_auth_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_auth_user_id
  ON public.students(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

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
    activation_code_created_at,
    created_by_teacher_id
  )
  VALUES (
    p_class_id,
    p_first_name,
    p_first_name,
    'QR-' || encode(extensions.gen_random_bytes(16), 'hex'),
    true,
    public.hash_activation_code(v_code),
    now(),
    v_teacher_id
  )
  RETURNING id INTO v_student_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'activation_code', v_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_add_student_auth(
  p_class_id uuid,
  p_first_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_code text;
BEGIN
  IF NOT public.teacher_can_access_class(p_class_id) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  p_first_name := trim(p_first_name);
  IF p_first_name = '' THEN
    RETURN jsonb_build_object('error', 'Name fehlt');
  END IF;

  LOOP
    v_code := public.generate_activation_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.students
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
    activation_code_created_at,
    created_by_auth_teacher_id
  )
  VALUES (
    p_class_id,
    p_first_name,
    p_first_name,
    'QR-' || encode(extensions.gen_random_bytes(16), 'hex'),
    true,
    public.hash_activation_code(v_code),
    now(),
    auth.uid()
  )
  RETURNING id INTO v_student_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
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

  IF v_student.activation_code_used_at IS NOT NULL OR v_student.auth_user_id IS NOT NULL THEN
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
    'email', 'qr-' || replace(v_student.id::text, '-', '') || '@qr.boost-schule.app'
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

  IF v_student.auth_user_id IS NOT NULL AND v_student.auth_user_id <> v_auth_user_id THEN
    RETURN jsonb_build_object('error', 'Dieser QR-Code wurde bereits verwendet');
  END IF;

  IF v_student.activation_code_used_at IS NOT NULL AND v_student.auth_user_id IS DISTINCT FROM v_auth_user_id THEN
    RETURN jsonb_build_object('error', 'Dieser QR-Code wurde bereits verwendet');
  END IF;

  IF COALESCE(v_student.active, true) = false OR v_student.deactivated_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Dieses Profil ist deaktiviert');
  END IF;

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

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_auth_user_id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

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
  WHERE user_id = v_student.id
  ON CONFLICT (user_id, date) DO UPDATE
  SET push_ups = GREATEST(COALESCE(public.daily_results.push_ups, 0), COALESCE(EXCLUDED.push_ups, 0)),
      squats = GREATEST(COALESCE(public.daily_results.squats, 0), COALESCE(EXCLUDED.squats, 0)),
      planks = GREATEST(COALESCE(public.daily_results.planks, 0), COALESCE(EXCLUDED.planks, 0)),
      sit_ups = GREATEST(COALESCE(public.daily_results.sit_ups, 0), COALESCE(EXCLUDED.sit_ups, 0)),
      jumping_jacks = GREATEST(COALESCE(public.daily_results.jumping_jacks, 0), COALESCE(EXCLUDED.jumping_jacks, 0)),
      steps = GREATEST(COALESCE(public.daily_results.steps, 0), COALESCE(EXCLUDED.steps, 0)),
      steps_tracking_active = COALESCE(public.daily_results.steps_tracking_active, false) OR COALESCE(EXCLUDED.steps_tracking_active, false);

  DELETE FROM public.daily_results
  WHERE user_id = v_student.id;

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

GRANT EXECUTE ON FUNCTION public.prepare_student_qr_registration(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_student_qr_registration(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
