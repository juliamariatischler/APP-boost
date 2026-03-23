ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS age integer;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_age_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_age_check CHECK (age IS NULL OR (age >= 6 AND age <= 19));

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
  v_profile_age integer;
BEGIN
  v_account_type := COALESCE(NULLIF(new.raw_user_meta_data->>'account_type', ''), 'student');
  v_profile_class := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'class'), ''), 'unbekannt');
  v_profile_school := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'school'), ''), 'unbekannt');
  v_profile_age := NULLIF(trim(new.raw_user_meta_data->>'age'), '')::integer;

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
      INSERT INTO public.profiles (id, username, school, class, age)
      VALUES (new.id, v_username, v_profile_school, v_profile_class, v_profile_age);
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
