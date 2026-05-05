-- Keep public demo accounts usable, but constrain their database reach to
-- DemoSchule / 4a so the published demo credentials cannot access real data.

CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) IN (
        'demo@boost-challenge.de',
        'demo-lehrkraft@boost-challenge.de'
      )
  );
$$;

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
      AND p.school = 'DemoSchule'
      AND p.class = '4a'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_demo_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_demo_profile(uuid) TO authenticated;

-- Profiles: demo users may only read the demo class; normal users keep
-- existing own-profile/admin access and can discover classmates.
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;
CREATE POLICY "Authenticated users can view scoped profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR (
    public.is_demo_user(auth.uid())
    AND school = 'DemoSchule'
    AND class = '4a'
  )
  OR (
    NOT public.is_demo_user(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles viewer
      WHERE viewer.id = auth.uid()
        AND viewer.school = profiles.school
        AND viewer.class = profiles.class
    )
  )
);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND (
    NOT public.is_demo_user(auth.uid())
    OR (school = 'DemoSchule' AND class = '4a')
  )
);

DROP POLICY IF EXISTS "Admins can view all results" ON public.daily_results;
CREATE POLICY "Admins can view all results"
ON public.daily_results
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND (
    NOT public.is_demo_user(auth.uid())
    OR public.is_demo_profile(user_id)
  )
);

-- Demo teachers must not manage platform-wide role assignments.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND NOT public.is_demo_user(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND NOT public.is_demo_user(auth.uid())
);

-- Demo teachers can only create/remove assignments for demo profiles.
DROP POLICY IF EXISTS "Teachers can create own assignments" ON public.teacher_student_assignments;
CREATE POLICY "Teachers can create own assignments"
ON public.teacher_student_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = auth.uid()
  AND public.has_role(auth.uid(), 'admin')
  AND (
    NOT public.is_demo_user(auth.uid())
    OR public.is_demo_profile(student_id)
  )
);

DROP POLICY IF EXISTS "Teachers can delete own assignments" ON public.teacher_student_assignments;
CREATE POLICY "Teachers can delete own assignments"
ON public.teacher_student_assignments
FOR DELETE
TO authenticated
USING (
  teacher_id = auth.uid()
  AND public.has_role(auth.uid(), 'admin')
  AND (
    NOT public.is_demo_user(auth.uid())
    OR public.is_demo_profile(student_id)
  )
);

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

  IF public.is_demo_user(auth.uid()) AND (p_school <> 'DemoSchule' OR p_class <> '4a') THEN
    RAISE EXCEPTION 'Unauthorized: Demo teacher is limited to DemoSchule/4a';
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

-- Demo teachers can read/update only demo reward redemptions.
DROP POLICY IF EXISTS "Users can read own reward redemptions" ON public.reward_redemptions;
CREATE POLICY "Users can read own reward redemptions"
ON public.reward_redemptions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (
    public.has_role(auth.uid(), 'admin')
    AND (
      NOT public.is_demo_user(auth.uid())
      OR public.is_demo_profile(user_id)
    )
  )
);

DROP POLICY IF EXISTS "Admins update reward redemptions" ON public.reward_redemptions;
CREATE POLICY "Admins update reward redemptions"
ON public.reward_redemptions
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND (
    NOT public.is_demo_user(auth.uid())
    OR public.is_demo_profile(user_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND (
    NOT public.is_demo_user(auth.uid())
    OR public.is_demo_profile(user_id)
  )
);

-- Demo teachers are viewers, not global content managers.
DROP POLICY IF EXISTS "Admins manage reward items" ON public.reward_items;
CREATE POLICY "Admins manage reward items"
ON public.reward_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()));

DROP POLICY IF EXISTS "Admins manage class milestones" ON public.class_milestones;
CREATE POLICY "Admins manage class milestones"
ON public.class_milestones
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()));

DROP POLICY IF EXISTS "Admins manage presentation class rankings" ON public.presentation_class_rankings;
CREATE POLICY "Admins manage presentation class rankings"
ON public.presentation_class_rankings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()));
