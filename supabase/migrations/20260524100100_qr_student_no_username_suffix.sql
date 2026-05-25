-- ============================================================
-- QR-Schüler: Kein Hash-Suffix mehr im Benutzernamen
--
-- Vorher: "Rafaela_396cade8"  →  Nachher: "Rafaela"
--
-- Ursache: handle_new_user fügte bei Username-Kollision einen
-- MD5-Suffix an. QR-Schüler brauchen keine globale Eindeutigkeit
-- (der Lehrer stellt sicher, dass Namen in der Klasse eindeutig sind).
--
-- Lösung:
--  1. profiles.is_qr_student-Spalte hinzufügen
--  2. Unique-Constraint durch partiellen Unique-Index ersetzen
--     (gilt nur noch für Nicht-QR-Nutzer)
--  3. handle_new_user: QR-Registrierungen direkt ohne Suffix einfügen
--  4. complete_student_qr_registration: username immer auf Vornamen setzen
-- ============================================================

-- 1. Neue Spalte
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_qr_student boolean NOT NULL DEFAULT false;

-- 2. Alten Unique-Constraint entfernen und partiellen ersetzen
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_key;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_non_qr
  ON public.profiles(username)
  WHERE is_qr_student = false;

-- 3. handle_new_user: QR-Registrierungen ohne Kollisionsschleife einfügen
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
  v_is_qr boolean;
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

  -- QR-Registrierungen: E-Mail endet auf @qr.boost-schule.app
  v_is_qr := (new.email LIKE '%@qr.boost-schule.app');

  IF v_is_qr THEN
    -- Kein Unique-Constraint → direkt einfügen, kein Suffix nötig
    INSERT INTO public.profiles (id, username, school, class, age, role, is_qr_student)
    VALUES (new.id, v_username, v_profile_school, v_profile_class, v_profile_age, v_account_type, true)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    LOOP
      BEGIN
        INSERT INTO public.profiles (id, username, school, class, age, role)
        VALUES (new.id, v_username, v_profile_school, v_profile_class, v_profile_age, v_account_type);
        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;

          IF v_constraint IS DISTINCT FROM 'profiles_username_unique_non_qr' THEN
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
  END IF;

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

-- 4. complete_student_qr_registration: username immer auf sauberen Vornamen setzen
--    (behebt auch bereits registrierte Schüler mit Hash-Suffix)
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
  v_clean_username text;
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

  -- Sauberer Vorname (lowercase, nur alphanumerisch + _ -)
  v_clean_username := lower(regexp_replace(v_student.first_name, '[^a-zA-Z0-9_\-]', '', 'g'));
  v_clean_username := COALESCE(NULLIF(v_clean_username, ''), lower(v_student.display_name));

  UPDATE public.students
  SET auth_user_id = v_auth_user_id,
      device_id = p_device_id,
      activated_at = COALESCE(activated_at, now()),
      activation_code_used_at = COALESCE(activation_code_used_at, now())
  WHERE id = v_student.id;

  -- username immer auf sauberen Vornamen setzen (auch bei Re-Aktivierung)
  UPDATE public.profiles
  SET username     = v_clean_username,
      school       = v_school.name,
      class        = v_class.name,
      role         = 'student',
      age          = COALESCE(age, 10),
      is_qr_student = true
  WHERE id = v_auth_user_id;

  IF v_previous_auth_user_id IS NOT NULL AND v_previous_auth_user_id <> v_auth_user_id THEN
    UPDATE public.profiles
    SET school = 'Archiv',
        class  = 'Altes Gerät'
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
    user_id, date, push_ups, squats, planks, sit_ups,
    jumping_jacks, steps, steps_tracking_active
  )
  SELECT
    v_auth_user_id, date, push_ups, squats, planks, sit_ups,
    jumping_jacks, steps, steps_tracking_active
  FROM public.daily_results
  WHERE user_id IN (v_student.id, v_previous_auth_user_id)
    AND user_id IS DISTINCT FROM v_auth_user_id
  ON CONFLICT (user_id, date) DO UPDATE
  SET push_ups       = GREATEST(COALESCE(public.daily_results.push_ups, 0),       COALESCE(EXCLUDED.push_ups, 0)),
      squats         = GREATEST(COALESCE(public.daily_results.squats, 0),          COALESCE(EXCLUDED.squats, 0)),
      planks         = GREATEST(COALESCE(public.daily_results.planks, 0),          COALESCE(EXCLUDED.planks, 0)),
      sit_ups        = GREATEST(COALESCE(public.daily_results.sit_ups, 0),         COALESCE(EXCLUDED.sit_ups, 0)),
      jumping_jacks  = GREATEST(COALESCE(public.daily_results.jumping_jacks, 0),   COALESCE(EXCLUDED.jumping_jacks, 0)),
      steps          = GREATEST(COALESCE(public.daily_results.steps, 0),           COALESCE(EXCLUDED.steps, 0)),
      steps_tracking_active = COALESCE(public.daily_results.steps_tracking_active, false)
                           OR COALESCE(EXCLUDED.steps_tracking_active, false);

  DELETE FROM public.daily_results
  WHERE user_id IN (v_student.id, v_previous_auth_user_id)
    AND user_id IS DISTINCT FROM v_auth_user_id;

  RETURN jsonb_build_object(
    'user_type',   'student',
    'user_id',     v_auth_user_id,
    'student_id',  v_student.id,
    'display_name', v_student.display_name,
    'class_id',    v_class.id,
    'class_name',  v_class.name,
    'school_name', v_school.name
  );
END;
$$;

-- Berechtigungen wiederherstellen
REVOKE EXECUTE ON FUNCTION public.complete_student_qr_registration(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_student_qr_registration(text, text) TO authenticated;
