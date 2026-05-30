-- Normalize class names to UPPER on insert/lookup so "1c" and "1C" are treated as the same class.

CREATE OR REPLACE FUNCTION public.add_class_to_school(
  p_school_id  uuid,
  p_class_name text
)
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id   uuid;
  v_name text := upper(replace(trim(p_class_name), ' ', ''));
BEGIN
  IF length(v_name) < 1 THEN
    RAISE EXCEPTION 'Klassenname darf nicht leer sein';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.schools sch WHERE sch.id = p_school_id AND sch.active = true) THEN
    RAISE EXCEPTION 'Schule nicht gefunden';
  END IF;

  INSERT INTO public.classes (school_id, name, active)
  VALUES (p_school_id, v_name, true)
  ON CONFLICT DO NOTHING;

  SELECT c.id INTO v_id
  FROM   public.classes c
  WHERE  c.school_id = p_school_id AND c.name = v_name;

  RETURN QUERY SELECT v_id, v_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_class_to_school(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_class_to_school(uuid, text) TO authenticated;


DROP FUNCTION IF EXISTS public.create_class_and_assign_auth(uuid, text);

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
  v_class_name text := upper(replace(trim(p_class_name), ' ', ''));
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

  INSERT INTO public.classes (school_id, name, active)
  VALUES (p_school_id, v_class_name, true)
  ON CONFLICT (school_id, name) DO NOTHING;

  SELECT c.id INTO v_class_id
  FROM   public.classes c
  WHERE  c.school_id = p_school_id AND c.name = v_class_name;

  INSERT INTO public.teacher_class_assignments (teacher_id, school_id, class_id)
  VALUES (auth.uid(), p_school_id, v_class_id)
  ON CONFLICT (teacher_id, class_id) DO NOTHING;

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

NOTIFY pgrst, 'reload schema';
