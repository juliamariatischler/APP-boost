-- Rename DemoSchule → BoostSchule everywhere.

-- 1. Data: profiles table
UPDATE public.profiles
SET school = 'BoostSchule'
WHERE school = 'DemoSchule';

-- 2. Data: schools table (if a row exists)
UPDATE public.schools
SET name = 'BoostSchule'
WHERE lower(name) = lower('DemoSchule');

-- 3. Recreate functions that hardcode 'DemoSchule'

CREATE OR REPLACE FUNCTION public.is_demo_profile(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.school = 'BoostSchule'
      AND p.class = '4a'
  );
$$;

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

-- 4. Recreate policies that reference 'DemoSchule'

DROP POLICY IF EXISTS "Authenticated users can view scoped profile info" ON public.profiles;
CREATE POLICY "Authenticated users can view scoped profile info"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR (
    public.is_demo_user(auth.uid())
    AND school = 'BoostSchule'
    AND class = '4a'
  )
  OR (
    NOT public.is_demo_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles viewer
      WHERE viewer.id = auth.uid()
        AND viewer.school = profiles.school
        AND viewer.class = profiles.class
    )
  )
);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND (
    NOT public.is_demo_user(auth.uid())
    OR (school = 'BoostSchule' AND class = '4a')
  )
);
