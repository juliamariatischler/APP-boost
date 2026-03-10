-- Allow students to request missing schools directly from signup.

CREATE TABLE IF NOT EXISTS public.school_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_school text NOT NULL,
  requester_email text,
  requester_name text,
  request_note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.school_registration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create school registration requests" ON public.school_registration_requests;
CREATE POLICY "Anyone can create school registration requests"
  ON public.school_registration_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(requested_school)) >= 2
    AND length(trim(requested_school)) <= 120
    AND (requester_email IS NULL OR length(trim(requester_email)) <= 255)
    AND (requester_name IS NULL OR length(trim(requester_name)) <= 80)
    AND (request_note IS NULL OR length(trim(request_note)) <= 400)
  );

DROP POLICY IF EXISTS "Admins can view school registration requests" ON public.school_registration_requests;
CREATE POLICY "Admins can view school registration requests"
  ON public.school_registration_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update school registration requests" ON public.school_registration_requests;
CREATE POLICY "Admins can update school registration requests"
  ON public.school_registration_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_school_registration_requests_status_created_at
  ON public.school_registration_requests (status, created_at DESC);
