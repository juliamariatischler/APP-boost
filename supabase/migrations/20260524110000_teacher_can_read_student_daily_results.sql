-- Allow teachers to read daily_results for their own students.
-- Previously the only policy was "Admins can view all results" which for
-- demo teachers additionally required is_demo_profile(user_id) – this
-- excluded non-activated students whose user_id is their student.id and
-- therefore never in the profiles table.

DROP POLICY IF EXISTS "Teachers can view their students results" ON public.daily_results;

CREATE POLICY "Teachers can view their students results"
ON public.daily_results
FOR SELECT
TO authenticated
USING (
  -- Auth teachers: class access via teacher_class_access table
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.teacher_class_access tca ON tca.class_id = s.class_id
    WHERE tca.teacher_id = auth.uid()
      AND COALESCE(s.auth_user_id, s.id) = daily_results.user_id
  )
);

NOTIFY pgrst, 'reload schema';
