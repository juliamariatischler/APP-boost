-- Allow teacher self-signup without a separate teacher code.
-- Teachers are promoted to admin role based on account_type only.

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
  v_base_username text;
  v_username text;
  v_attempt integer := 0;
  v_constraint text;
BEGIN
  v_account_type := COALESCE(NULLIF(new.raw_user_meta_data->>'account_type', ''), 'student');
  v_profile_class := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'class'), ''), 'unbekannt');
  v_profile_school := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'school'), ''), 'unbekannt');

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
      INSERT INTO public.profiles (id, username, school, class)
      VALUES (new.id, v_username, v_profile_school, v_profile_class);
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
