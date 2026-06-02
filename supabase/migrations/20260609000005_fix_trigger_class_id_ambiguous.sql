-- Fix: "column reference class_id is ambiguous" in auto_accept_claimed_class_student trigger.
-- The trigger fired on INSERT to teacher_student_assignments. Both that table (via NEW)
-- and teacher_class_assignments (the FROM table in the EXISTS subquery) have class_id and
-- teacher_id columns, which PostgreSQL flags as ambiguous. Fix: qualify with table alias tca.

CREATE OR REPLACE FUNCTION public.auto_accept_claimed_class_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status = 'pending'
     AND NEW.class_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.teacher_class_assignments tca
       WHERE tca.teacher_id = NEW.teacher_id
         AND tca.class_id   = NEW.class_id
     )
  THEN
    NEW.approval_status := 'accepted';
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
