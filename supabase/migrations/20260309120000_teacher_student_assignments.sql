-- Teacher -> Student assignment table for scoped teacher admin view
CREATE TABLE IF NOT EXISTS public.teacher_student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (teacher_id, student_id)
);

ALTER TABLE public.teacher_student_assignments ENABLE ROW LEVEL SECURITY;

-- Teachers/admins can only see their own assignment rows
CREATE POLICY "Teachers can view own assignments"
ON public.teacher_student_assignments
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- Teachers/admins can only create their own assignment rows
CREATE POLICY "Teachers can create own assignments"
ON public.teacher_student_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = auth.uid()
  AND public.has_role(auth.uid(), 'admin')
);

-- Teachers/admins can only delete their own assignment rows
CREATE POLICY "Teachers can delete own assignments"
ON public.teacher_student_assignments
FOR DELETE
TO authenticated
USING (
  teacher_id = auth.uid()
  AND public.has_role(auth.uid(), 'admin')
);

-- Helper RPC: assign all students of a class/school to a teacher (idempotent)
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
