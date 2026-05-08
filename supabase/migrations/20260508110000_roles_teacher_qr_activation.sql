-- Role routing and QR-based student activation.
-- Existing users without an explicit role remain students.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student'
  CHECK (role IN ('student', 'teacher'));

UPDATE public.profiles p
SET role = 'teacher'
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
    AND ur.role = 'admin'::public.app_role
);

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE p.role = 'teacher'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles
SET role = 'student'
WHERE role IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS activation_code_hash text,
  ADD COLUMN IF NOT EXISTS activation_code_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_code_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_students_activation_code_hash
  ON public.students(activation_code_hash)
  WHERE activation_code_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.student_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  device_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_security_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_student_security_events_student
  ON public.student_security_events(student_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type text;
  v_profile_class text;
  v_profile_school text;
  v_profile_age integer;
  v_base_username text;
  v_username text;
  v_attempt integer := 0;
  v_constraint text;
BEGIN
  v_account_type := COALESCE(NULLIF(lower(new.raw_user_meta_data->>'account_type'), ''), 'student');
  IF v_account_type NOT IN ('student', 'teacher') THEN
    v_account_type := 'student';
  END IF;

  v_profile_class := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'class'), ''), 'unbekannt');
  v_profile_school := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'school'), ''), 'unbekannt');
  v_profile_age := NULLIF(trim(new.raw_user_meta_data->>'age'), '')::integer;

  IF v_account_type = 'teacher' AND v_profile_class = 'unbekannt' THEN
    v_profile_class := 'Lehrkraft';
    v_profile_age := NULL;
  END IF;

  v_base_username := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'username'), ''),
    NULLIF(split_part(new.email, '@', 1), ''),
    'user'
  );

  v_username := lower(regexp_replace(v_base_username, '[^a-zA-Z0-9_\-]', '', 'g'));
  v_username := COALESCE(NULLIF(v_username, ''), 'user');
  v_username := left(v_username, 40);

  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username, school, class, age, role)
      VALUES (new.id, v_username, v_profile_school, v_profile_class, v_profile_age, v_account_type);
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;

        IF v_constraint IS DISTINCT FROM 'profiles_username_key' THEN
          RAISE;
        END IF;

        v_attempt := v_attempt + 1;
        IF v_attempt > 25 THEN
          RAISE EXCEPTION 'Could not generate unique username after % attempts', v_attempt;
        END IF;

        v_username := left(v_username, 30) || '_' || substr(md5(new.id::text || v_attempt::text), 1, 8);
      WHEN OTHERS THEN
        RAISE;
    END;
  END LOOP;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_account_type = 'teacher' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

UPDATE public.profiles p
SET role = 'teacher'
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) = 'demo-lehrkraft@boost-challenge.de';

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'demo-lehrkraft@boost-challenge.de'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_current_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'teacher'
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_activation_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_bytes bytea;
  i integer;
BEGIN
  v_bytes := extensions.gen_random_bytes(20);

  FOR i IN 1..20 LOOP
    v_code := v_code || substr(v_chars, 1 + (get_byte(v_bytes, i - 1) % length(v_chars)), 1);
  END LOOP;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_activation_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.ensure_teacher_default_class()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_school_id uuid;
  v_class_id uuid;
  v_school_name text;
  v_class_name text;
BEGIN
  IF NOT public.is_current_teacher() THEN
    RAISE EXCEPTION 'Unauthorized: teacher role required';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  v_school_name := COALESCE(NULLIF(v_profile.school, ''), 'BOOST Schule');
  v_class_name := COALESCE(NULLIF(v_profile.class, ''), 'Demo-Klasse');
  IF v_class_name = 'Lehrkraft' OR v_class_name = 'unbekannt' THEN
    v_class_name := 'Demo-Klasse';
  END IF;

  SELECT id INTO v_school_id
  FROM public.schools
  WHERE lower(name) = lower(v_school_name)
  ORDER BY created_at
  LIMIT 1;

  IF v_school_id IS NULL THEN
    INSERT INTO public.schools (name, active)
    VALUES (v_school_name, true)
    RETURNING id INTO v_school_id;
  END IF;

  SELECT id INTO v_class_id
  FROM public.classes
  WHERE school_id = v_school_id
    AND lower(name) = lower(v_class_name)
  ORDER BY created_at
  LIMIT 1;

  IF v_class_id IS NULL THEN
    INSERT INTO public.classes (school_id, name, active)
    VALUES (v_school_id, v_class_name, true)
    RETURNING id INTO v_class_id;
  END IF;

  RETURN v_class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_class(p_class_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_school_name text;
BEGIN
  IF NOT public.is_current_teacher() THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT s.name INTO v_school_name
  FROM public.classes c
  JOIN public.schools s ON s.id = c.school_id
  WHERE c.id = p_class_id;

  RETURN v_school_name IS NOT NULL
    AND lower(v_school_name) = lower(COALESCE(NULLIF(v_profile.school, ''), v_school_name));
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_get_classes_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_result jsonb;
BEGIN
  PERFORM public.ensure_teacher_default_class();

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT jsonb_agg(
    jsonb_build_object(
      'class_id', c.id,
      'class_name', c.name,
      'school_name', s.name,
      'student_count', (
        SELECT count(*)
        FROM public.students st
        WHERE st.class_id = c.id
          AND COALESCE(st.active, true) = true
      )
    )
    ORDER BY c.name
  ) INTO v_result
  FROM public.classes c
  JOIN public.schools s ON s.id = c.school_id
  WHERE c.active = true
    AND lower(s.name) = lower(COALESCE(NULLIF(v_profile.school, ''), s.name));

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_get_students_auth(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.teacher_can_access_class(p_class_id) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'student_id', id,
      'display_name', display_name,
      'first_name', first_name,
      'active', active,
      'activated_at', activated_at,
      'device_id', device_id,
      'activation_code_created_at', activation_code_created_at,
      'activation_code_used_at', activation_code_used_at
    )
    ORDER BY display_name
  ) INTO v_result
  FROM public.students
  WHERE class_id = p_class_id
    AND deactivated_at IS NULL;

  RETURN COALESCE(v_result, '[]'::jsonb);
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

CREATE OR REPLACE FUNCTION public.teacher_reset_student_device_auth(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
BEGIN
  SELECT class_id INTO v_class_id
  FROM public.students
  WHERE id = p_student_id
    AND deactivated_at IS NULL;

  IF v_class_id IS NULL OR NOT public.teacher_can_access_class(v_class_id) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese:n Schüler:in');
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

  INSERT INTO public.student_security_events (student_id, teacher_id, event_type)
  VALUES (p_student_id, auth.uid(), 'device_reset_by_teacher');

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_deactivate_student_auth(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
BEGIN
  SELECT class_id INTO v_class_id
  FROM public.students
  WHERE id = p_student_id;

  IF v_class_id IS NULL OR NOT public.teacher_can_access_class(v_class_id) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese:n Schüler:in');
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

  INSERT INTO public.student_security_events (student_id, teacher_id, event_type)
  VALUES (p_student_id, auth.uid(), 'student_deactivated_by_teacher');

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_student_qr(
  p_code text,
  p_device_id text
)
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
  v_session_id uuid;
  v_session_token text;
  v_expires_at timestamptz := now() + interval '30 days';
BEGIN
  p_code := upper(trim(p_code));
  p_device_id := trim(p_device_id);

  IF p_code = '' OR p_device_id = '' THEN
    INSERT INTO public.student_security_events (event_type, device_id, metadata)
    VALUES ('invalid_qr_code', p_device_id, jsonb_build_object('reason', 'empty_code'));
    RETURN jsonb_build_object('error', 'Ungueltiger Aktivierungscode');
  END IF;

  v_hash := public.hash_activation_code(p_code);

  SELECT * INTO v_student
  FROM public.students
  WHERE activation_code_hash = v_hash
  ORDER BY activation_code_created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.student_security_events (event_type, device_id, metadata)
    VALUES ('invalid_qr_code', p_device_id, jsonb_build_object('code_hash', v_hash));
    RETURN jsonb_build_object('error', 'Ungueltiger Aktivierungscode');
  END IF;

  IF v_student.activation_code_used_at IS NOT NULL THEN
    INSERT INTO public.student_security_events (student_id, event_type, device_id)
    VALUES (v_student.id, 'already_used_qr_code', p_device_id);
    RETURN jsonb_build_object('error', 'Dieser QR-Code wurde bereits verwendet');
  END IF;

  IF COALESCE(v_student.active, true) = false OR v_student.deactivated_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Dieses Profil ist deaktiviert');
  END IF;

  IF v_student.device_id IS NOT NULL AND v_student.device_id <> p_device_id THEN
    INSERT INTO public.student_security_events (student_id, event_type, device_id)
    VALUES (v_student.id, 'login_attempt_other_device', p_device_id);
    RETURN jsonb_build_object('error', 'Dieses Profil ist bereits mit einem anderen Geraet verbunden');
  END IF;

  v_session_token := encode(extensions.gen_random_bytes(32), 'hex');

  UPDATE public.active_sessions
  SET active = false,
      last_seen_at = now()
  WHERE user_type = 'student'
    AND user_id = v_student.id
    AND active = true;

  UPDATE public.students
  SET device_id = p_device_id,
      activated_at = COALESCE(activated_at, now()),
      activation_code_used_at = now()
  WHERE id = v_student.id;

  INSERT INTO public.active_sessions (
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

  SELECT * INTO v_class FROM public.classes WHERE id = v_student.class_id;
  SELECT * INTO v_school FROM public.schools WHERE id = v_class.school_id;

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
  v_session public.active_sessions%ROWTYPE;
  v_access boolean;
  v_result jsonb;
BEGIN
  SELECT * INTO v_session
  FROM public.active_sessions
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
    SELECT 1 FROM public.teacher_class_access
    WHERE teacher_id = v_session.user_id
      AND class_id = p_class_id
  ) INTO v_access;

  IF NOT v_access THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'student_id', id,
      'display_name', display_name,
      'first_name', first_name,
      'active', active,
      'activated_at', activated_at,
      'device_id', device_id,
      'activation_code_created_at', activation_code_created_at,
      'activation_code_used_at', activation_code_used_at
    )
    ORDER BY display_name
  ) INTO v_result
  FROM public.students
  WHERE class_id = p_class_id
    AND deactivated_at IS NULL;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_get_classes_auth() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_get_students_auth(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_add_student_auth(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_generate_student_activation_auth(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_reset_student_device_auth(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.teacher_deactivate_student_auth(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_student_qr(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_class_students(text, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.teacher_get_classes_auth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_get_students_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_add_student_auth(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_generate_student_activation_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_reset_student_device_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_deactivate_student_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_student_qr(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_students(text, text, uuid) TO anon, authenticated;
