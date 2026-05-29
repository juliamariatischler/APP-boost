-- Also adds school_id to the teacher_get_classes_auth result so the frontend
-- can pre-fill the school selector in the "Neue Klasse anlegen" dialog.

CREATE OR REPLACE FUNCTION public.teacher_get_classes_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_result  jsonb;
BEGIN
  PERFORM public.ensure_teacher_default_class();

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT jsonb_agg(
    jsonb_build_object(
      'class_id',      c.id,
      'class_name',    c.name,
      'school_id',     s.id,
      'school_name',   s.name,
      'student_count', (
        SELECT count(*) FROM (
          SELECT st.id
          FROM   public.students st
          WHERE  st.class_id        = c.id
            AND  COALESCE(st.active, true) = true
            AND  st.deactivated_at IS NULL
          UNION
          SELECT pr.id
          FROM   public.profiles pr
          WHERE  pr.class_id = c.id
            AND  pr.role     = 'student'
            AND  NOT EXISTS (
                   SELECT 1 FROM public.students s2
                   WHERE  s2.auth_user_id  = pr.id
                     AND  s2.class_id      = c.id
                     AND  s2.deactivated_at IS NULL
                 )
        ) combined
      )
    )
    ORDER BY c.name
  ) INTO v_result
  FROM public.classes c
  JOIN public.schools s ON s.id = c.school_id
  WHERE c.active = true
    AND lower(s.name) = lower(COALESCE(NULLIF(v_profile.school, ''), s.name))
    AND NOT EXISTS (
          SELECT 1
          FROM   public.teacher_class_assignments tca
          WHERE  tca.class_id   = c.id
            AND  tca.teacher_id != auth.uid()
        );

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ── RPC: create_class_and_assign_auth
-- Atomically creates a new class (or reuses one with the same name in that school)
-- and assigns the authenticated teacher to it. Also queues any students who have
-- already registered for that class as pending assignments.

CREATE OR REPLACE FUNCTION public.create_class_and_assign_auth(
  p_school_id  uuid,
  p_class_name text
)
RETURNS TABLE (class_id uuid, class_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id   uuid;
  v_class_name text := trim(p_class_name);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin-Rolle erforderlich';
  END IF;

  IF length(v_class_name) < 1 THEN
    RAISE EXCEPTION 'Klassenname darf nicht leer sein';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id AND active = true) THEN
    RAISE EXCEPTION 'Schule nicht gefunden';
  END IF;

  -- Create the class if it doesn't already exist
  INSERT INTO public.classes (school_id, name, active)
  VALUES (p_school_id, v_class_name, true)
  ON CONFLICT (school_id, name) DO NOTHING;

  SELECT c.id INTO v_class_id
  FROM   public.classes c
  WHERE  c.school_id = p_school_id AND c.name = v_class_name;

  -- Assign this teacher to the class
  INSERT INTO public.teacher_class_assignments (teacher_id, school_id, class_id)
  VALUES (auth.uid(), p_school_id, v_class_id)
  ON CONFLICT (teacher_id, class_id) DO NOTHING;

  -- Queue any already-registered students in this class as pending
  INSERT INTO public.teacher_student_assignments
    (teacher_id, student_id, approval_status, school_id, class_id)
  SELECT
    auth.uid(), p.id, 'pending', p_school_id, v_class_id
  FROM public.profiles p
  WHERE p.class_id  = v_class_id
    AND p.school_id = p_school_id
    AND p.role      = 'student'
  ON CONFLICT (teacher_id, student_id) DO NOTHING;

  RETURN QUERY SELECT v_class_id, v_class_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_class_and_assign_auth(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_class_and_assign_auth(uuid, text) TO authenticated;
