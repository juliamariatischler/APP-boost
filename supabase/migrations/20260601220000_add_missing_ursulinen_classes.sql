-- Add missing classes 3E and 4B to the classes table for Ursulinen Gym.
-- These classes have real students (visible in the ranking) but were never
-- inserted into the classes table, so they don't appear in the registration
-- dropdown. Also links existing profile rows to the new class IDs.

DO $$
DECLARE
  v_school_id uuid;
  v_class_3e  uuid;
  v_class_4b  uuid;
BEGIN
  SELECT id INTO v_school_id
  FROM public.schools
  WHERE name = 'Ursulinen Gym' AND active = true
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE NOTICE 'Ursulinen Gym school not found — skipping';
    RETURN;
  END IF;

  -- Insert 3E
  INSERT INTO public.classes (school_id, name, active)
  VALUES (v_school_id, '3E', true)
  ON CONFLICT (school_id, name) DO NOTHING;

  SELECT id INTO v_class_3e
  FROM public.classes
  WHERE school_id = v_school_id AND name = '3E';

  -- Insert 4B
  INSERT INTO public.classes (school_id, name, active)
  VALUES (v_school_id, '4B', true)
  ON CONFLICT (school_id, name) DO NOTHING;

  SELECT id INTO v_class_4b
  FROM public.classes
  WHERE school_id = v_school_id AND name = '4B';

  -- Link existing students whose free-text class matches '3E' at Ursulinen Gym
  UPDATE public.profiles
  SET school_id = v_school_id,
      class_id  = v_class_3e
  WHERE school    = 'Ursulinen Gym'
    AND class     = '3E'
    AND class_id  IS NULL;

  -- Link existing students whose free-text class matches '4B' at Ursulinen Gym
  UPDATE public.profiles
  SET school_id = v_school_id,
      class_id  = v_class_4b
  WHERE school    = 'Ursulinen Gym'
    AND class     = '4B'
    AND class_id  IS NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
