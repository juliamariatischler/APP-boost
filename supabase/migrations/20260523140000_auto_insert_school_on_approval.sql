-- Automatically insert into schools when a registration request is approved.

CREATE OR REPLACE FUNCTION public.handle_school_request_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(NEW.requested_school);
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF length(v_name) >= 2 AND NOT EXISTS (
      SELECT 1 FROM public.schools WHERE lower(name) = lower(v_name)
    ) THEN
      INSERT INTO public.schools (name, active) VALUES (v_name, true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_request_approved ON public.school_registration_requests;
CREATE TRIGGER trg_school_request_approved
  AFTER UPDATE ON public.school_registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_school_request_approved();
