-- For every school in the schools table, ensure that all class names
-- used in profiles (free-text "class" field) exist in the classes table,
-- then back-fill school_id / class_id on profiles that are still NULL.
--
-- This is idempotent: ON CONFLICT DO NOTHING / WHERE class_id IS NULL.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Step 1: Insert any missing (school, class) pairs into the classes table.
  --   Source: profiles with a non-null, non-empty "class" text AND a "school"
  --   that matches an active school by name.
  FOR r IN
    SELECT DISTINCT
      s.id   AS school_id,
      upper(replace(trim(p.class), ' ', '')) AS class_name
    FROM public.profiles p
    JOIN public.schools  s ON s.name = p.school AND s.active = true
    WHERE p.class  IS NOT NULL
      AND trim(p.class) <> ''
      AND trim(p.class) <> 'unbekannt'
      AND trim(p.class) <> 'Lehrkraft'
      AND p.role = 'student'
  LOOP
    INSERT INTO public.classes (school_id, name, active)
    VALUES (r.school_id, r.class_name, true)
    ON CONFLICT (school_id, name) DO NOTHING;
  END LOOP;

  -- Step 2: Back-fill school_id / class_id on profiles where it is still NULL.
  --   Match by (school text → schools.name) and (class text → classes.name).
  UPDATE public.profiles p
  SET
    school_id = s.id,
    class_id  = c.id
  FROM public.schools  s,
       public.classes  c
  WHERE s.name     = p.school
    AND s.active   = true
    AND c.school_id = s.id
    AND c.name     = upper(replace(trim(p.class), ' ', ''))
    AND c.active   = true
    AND p.role     = 'student'
    AND p.class_id IS NULL
    AND p.class    IS NOT NULL
    AND trim(p.class) <> ''
    AND trim(p.class) <> 'unbekannt';
END;
$$;

NOTIFY pgrst, 'reload schema';
