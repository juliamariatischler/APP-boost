-- Route public school registration requests through a validating RPC instead
-- of allowing direct table inserts from the browser.

CREATE OR REPLACE FUNCTION public.submit_school_registration_request(
  p_requested_school text,
  p_requester_email text DEFAULT NULL,
  p_requester_name text DEFAULT NULL,
  p_request_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
  v_school text := trim(COALESCE(p_requested_school, ''));
  v_email text := NULLIF(left(trim(COALESCE(p_requester_email, '')), 255), '');
  v_name text := NULLIF(left(trim(COALESCE(p_requester_name, '')), 120), '');
  v_note text := NULLIF(left(trim(COALESCE(p_request_note, '')), 500), '');
BEGIN
  IF length(v_school) < 2 OR length(v_school) > 120 THEN
    RAISE EXCEPTION 'Invalid school name';
  END IF;

  IF v_email IS NOT NULL AND v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid requester email';
  END IF;

  SELECT id
  INTO v_request_id
  FROM public.school_registration_requests
  WHERE lower(requested_school) = lower(v_school)
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_request_id;
  END IF;

  INSERT INTO public.school_registration_requests (
    requested_school,
    requester_email,
    requester_name,
    request_note,
    status
  )
  VALUES (
    left(v_school, 120),
    v_email,
    v_name,
    v_note,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_school_registration_request(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_school_registration_request(text, text, text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can create school registration requests" ON public.school_registration_requests;
