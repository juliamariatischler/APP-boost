-- Fix RLS policy for teachers reading daily_results.
--
-- The previous policy used teacher_class_access which is empty for
-- supabase-auth teachers. These teachers are authorized via school-name
-- matching (same logic as teacher_can_access_class / teacher_get_students_auth).
-- The new policy mirrors that logic so both auth mechanisms work.

DROP POLICY IF EXISTS "Teachers can view their students results" ON public.daily_results;

CREATE POLICY "Teachers can view their students results"
ON public.daily_results
FOR SELECT
TO authenticated
USING (
  -- Teacher must be authenticated as a teacher (profiles.role='teacher' OR admin role)
  public.is_current_teacher()
  AND EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classes c  ON c.id  = s.class_id
    JOIN public.schools sch ON sch.id = c.school_id
    JOIN public.profiles p  ON p.id  = auth.uid()
    WHERE s.deactivated_at IS NULL
      AND COALESCE(s.auth_user_id, s.id) = daily_results.user_id
      -- School-name matching: same logic as teacher_can_access_class()
      AND lower(sch.name) = lower(COALESCE(NULLIF(p.school, ''), sch.name))
  )
);

NOTIFY pgrst, 'reload schema';
