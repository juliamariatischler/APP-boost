-- Fix: migration 20260530100000_normalize_class_names_uppercase re-introduced
-- RETURNS TABLE (class_id uuid, ...) after the fix in 20260529120000, causing
-- "column reference class_id is ambiguous" because the output variable shadows
-- the column name in ON CONFLICT and WHERE clauses.
-- Rename output columns to out_class_id / out_class_name to remove the conflict.

DROP FUNCTION IF EXISTS public.create_class_and_assign_auth(uuid, text);

CREATE FUNCTION public.create_class_and_assign_auth(
  p_school_id  uuid,
  p_class_name text
)
RETURNS TABLE (out_class_id uuid, out_class_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id        uuid;
  v_class_name      text := upper(replace(trim(p_class_name), ' ', ''));
  v_teacher_school  uuid;
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

  IF NOT EXISTS (SELECT 1 FROM public.schools sch WHERE sch.id = p_school_id AND sch.active = true) THEN
    RAISE EXCEPTION 'Schule nicht gefunden';
  END IF;

  -- Enforce school restriction: teachers can only create classes for their own school
  SELECT p.school_id INTO v_teacher_school
  FROM   public.profiles p
  WHERE  p.id = auth.uid();

  IF v_teacher_school IS NULL THEN
    SELECT tca.school_id INTO v_teacher_school
    FROM   public.teacher_class_assignments tca
    WHERE  tca.teacher_id = auth.uid()
    LIMIT  1;
  END IF;

  IF v_teacher_school IS NOT NULL AND v_teacher_school <> p_school_id THEN
    RAISE EXCEPTION 'Klassen können nur für die eigene Schule angelegt werden';
  END IF;

  INSERT INTO public.classes (school_id, name, active)
  VALUES (p_school_id, v_class_name, true)
  ON CONFLICT (school_id, name) DO NOTHING;

  SELECT c.id INTO v_class_id
  FROM   public.classes c
  WHERE  c.school_id = p_school_id AND c.name = v_class_name;

  INSERT INTO public.teacher_class_assignments AS tca (teacher_id, school_id, class_id)
  VALUES (auth.uid(), p_school_id, v_class_id)
  ON CONFLICT (teacher_id, class_id) DO NOTHING;

  INSERT INTO public.teacher_student_assignments AS tsa
    (teacher_id, student_id, approval_status, school_id, class_id)
  SELECT auth.uid(), p.id, 'pending', p_school_id, v_class_id
  FROM   public.profiles p
  WHERE  p.class_id  = v_class_id
    AND  p.school_id = p_school_id
    AND  p.role      = 'student'
  ON CONFLICT (teacher_id, student_id) DO NOTHING;

  RETURN QUERY SELECT v_class_id, v_class_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_class_and_assign_auth(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_class_and_assign_auth(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
