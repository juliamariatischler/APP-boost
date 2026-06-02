-- When a student registers for a class that a teacher has already claimed,
-- automatically set approval_status = 'accepted' instead of leaving it 'pending'.
--
-- Without this, every new signup in a claimed class would land in the
-- teacher's pending-approval list and require manual approval.

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
       SELECT 1 FROM public.teacher_class_assignments
       WHERE teacher_id = NEW.teacher_id
         AND class_id   = NEW.class_id
     )
  THEN
    NEW.approval_status := 'accepted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tsa_auto_accept_claimed_class
  ON public.teacher_student_assignments;

CREATE TRIGGER tsa_auto_accept_claimed_class
BEFORE INSERT ON public.teacher_student_assignments
FOR EACH ROW EXECUTE FUNCTION public.auto_accept_claimed_class_student();

NOTIFY pgrst, 'reload schema';
