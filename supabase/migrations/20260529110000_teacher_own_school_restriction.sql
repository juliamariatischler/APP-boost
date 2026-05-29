-- ── 1. get_teacher_own_school_auth ───────────────────────────
-- Returns the single school that belongs to the authenticated teacher.
-- Checks profile.school_id first, then falls back to any existing
-- teacher_class_assignment. Returns empty when no school is known.

CREATE OR REPLACE FUNCTION public.get_teacher_own_school_auth()
RETURNS TABLE (school_id uuid, school_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1st priority: profile.school_id
  SELECT p.school_id INTO v_school_id
  FROM   public.profiles p
  WHERE  p.id = auth.uid();

  -- 2nd priority: first existing class assignment
  IF v_school_id IS NULL THEN
    SELECT tca.school_id INTO v_school_id
    FROM   public.teacher_class_assignments tca
    WHERE  tca.teacher_id = auth.uid()
    LIMIT  1;
  END IF;

  IF v_school_id IS NULL THEN
    RETURN; -- teacher has no school yet
  END IF;

  RETURN QUERY
  SELECT s.id, s.name
  FROM   public.schools s
  WHERE  s.id = v_school_id
    AND  s.active = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_teacher_own_school_auth() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_teacher_own_school_auth() TO authenticated;


-- ── 2. create_class_and_assign_auth (updated) ────────────────
-- Now validates that the requested school matches the teacher's own school.
-- A teacher can only create classes for their own school.

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
  v_class_id        uuid;
  v_class_name      text := trim(p_class_name);
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

  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id AND active = true) THEN
    RAISE EXCEPTION 'Schule nicht gefunden';
  END IF;

  -- Determine the teacher's own school (profile first, then existing assignment)
  SELECT p.school_id INTO v_teacher_school
  FROM   public.profiles p
  WHERE  p.id = auth.uid();

  IF v_teacher_school IS NULL THEN
    SELECT tca.school_id INTO v_teacher_school
    FROM   public.teacher_class_assignments tca
    WHERE  tca.teacher_id = auth.uid()
    LIMIT  1;
  END IF;

  -- Enforce school restriction when the teacher's school is known
  IF v_teacher_school IS NOT NULL AND v_teacher_school <> p_school_id THEN
    RAISE EXCEPTION 'Klassen können nur für die eigene Schule angelegt werden';
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
