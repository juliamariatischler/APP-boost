-- Patch: force-apply the BoostSchule check in assign_students_to_teacher_by_class.
-- Migration 20260510150100 was recorded as applied but the function was not updated
-- (database still raises "Demo teacher is limited to DemoSchule/4a").

CREATE OR REPLACE FUNCTION public.assign_students_to_teacher_by_class(
  p_teacher_id uuid,
  p_school text,
  p_class text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  IF auth.uid() != p_teacher_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot assign for another teacher';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  IF public.is_demo_user(auth.uid()) AND (p_school <> 'BoostSchule' OR p_class <> '4a') THEN
    RAISE EXCEPTION 'Unauthorized: Demo teacher is limited to BoostSchule/4a';
  END IF;

  INSERT INTO public.teacher_student_assignments (teacher_id, student_id, created_by)
  SELECT p_teacher_id, p.id, auth.uid()
  FROM public.profiles p
  LEFT JOIN public.user_roles ur
    ON ur.user_id = p.id
   AND ur.role = 'admin'
  WHERE p.school = p_school
    AND p.class = p_class
    AND ur.user_id IS NULL
  ON CONFLICT (teacher_id, student_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_students_to_teacher_by_class(uuid, text, text) TO authenticated;
