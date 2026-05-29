-- Fix: a teacher must only see classes they have explicitly claimed.
--
-- Root cause: teacher_get_classes_auth showed every class in the teacher's school
-- that was NOT claimed by someone else — so unassigned classes were visible to
-- ALL teachers of the same school.
--
-- Two changes:
--   1. ensure_teacher_default_class() now also inserts into teacher_class_assignments
--      so the auto-created default class is immediately "owned" by the teacher.
--   2. teacher_get_classes_auth() is rewritten to INNER JOIN teacher_class_assignments,
--      returning only classes the teacher has explicitly been assigned to.


-- ── 1. ensure_teacher_default_class ──────────────────────────
-- Now also creates the teacher_class_assignments row so the default class is
-- immediately owned by the teacher (and invisible to other teachers).

CREATE OR REPLACE FUNCTION public.ensure_teacher_default_class()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile     public.profiles%ROWTYPE;
  v_school_id   uuid;
  v_class_id    uuid;
  v_school_name text;
  v_class_name  text;
BEGIN
  IF NOT public.is_current_teacher() THEN
    RAISE EXCEPTION 'Unauthorized: teacher role required';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  v_school_name := COALESCE(NULLIF(v_profile.school, ''), 'BOOST Schule');
  v_class_name  := COALESCE(NULLIF(v_profile.class,  ''), 'Demo-Klasse');
  IF v_class_name IN ('Lehrkraft', 'unbekannt') THEN
    v_class_name := 'Demo-Klasse';
  END IF;

  -- Get or create school
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

  -- Get or create class
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

  -- Claim the class for this teacher (idempotent)
  INSERT INTO public.teacher_class_assignments (teacher_id, school_id, class_id)
  VALUES (auth.uid(), v_school_id, v_class_id)
  ON CONFLICT (teacher_id, class_id) DO NOTHING;

  RETURN v_class_id;
END;
$$;


-- ── 2. teacher_get_classes_auth ──────────────────────────────
-- Rewritten: INNER JOIN on teacher_class_assignments so a teacher only sees
-- classes they have explicitly been assigned to.

CREATE OR REPLACE FUNCTION public.teacher_get_classes_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.ensure_teacher_default_class();

  SELECT jsonb_agg(
    jsonb_build_object(
      'class_id',      c.id,
      'class_name',    c.name,
      'school_id',     s.id,
      'school_name',   s.name,
      'student_count', (
        SELECT count(*) FROM (
          -- QR-code students
          SELECT st.id
          FROM   public.students st
          WHERE  st.class_id       = c.id
            AND  COALESCE(st.active, true) = true
            AND  st.deactivated_at IS NULL
          UNION
          -- Self-registered profile students not yet in students table
          SELECT pr.id
          FROM   public.profiles pr
          WHERE  pr.class_id = c.id
            AND  pr.role     = 'student'
            AND  NOT EXISTS (
                   SELECT 1
                   FROM   public.students s2
                   WHERE  s2.auth_user_id  = pr.id
                     AND  s2.class_id      = c.id
                     AND  s2.deactivated_at IS NULL
                 )
        ) combined
      )
    )
    ORDER BY c.name
  ) INTO v_result
  FROM       public.classes c
  JOIN       public.schools s
          ON s.id = c.school_id
  -- Only classes this teacher has been explicitly assigned to
  JOIN       public.teacher_class_assignments tca
          ON tca.class_id   = c.id
         AND tca.teacher_id = auth.uid()
  WHERE c.active = true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
