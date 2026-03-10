-- Extend signup trigger to support teacher/admin onboarding via teacher code.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type text;
  v_teacher_code text;
  v_teacher_signup_code constant text := 'BOOST-LEHRER-2026';
  v_profile_class text;
BEGIN
  v_account_type := COALESCE(NULLIF(new.raw_user_meta_data->>'account_type', ''), 'student');
  v_teacher_code := COALESCE(new.raw_user_meta_data->>'teacher_code', '');
  v_profile_class := COALESCE(NULLIF(new.raw_user_meta_data->>'class', ''), 'unbekannt');

  INSERT INTO public.profiles (id, username, school, class)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'school',
    v_profile_class
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_account_type = 'teacher' AND v_teacher_code = v_teacher_signup_code THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;
