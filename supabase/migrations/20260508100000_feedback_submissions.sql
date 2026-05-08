-- Store in-app feedback submitted from the profile screen.

CREATE TABLE IF NOT EXISTS public.feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 3 AND 1000),
  page text NOT NULL DEFAULT 'profile' CHECK (char_length(page) BETWEEN 1 AND 80),
  user_agent text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_user_created
  ON public.feedback_submissions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_status_created
  ON public.feedback_submissions (status, created_at DESC);

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own feedback" ON public.feedback_submissions;
CREATE POLICY "Users can create own feedback"
ON public.feedback_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own feedback" ON public.feedback_submissions;
CREATE POLICY "Users can read own feedback"
ON public.feedback_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read feedback" ON public.feedback_submissions;
CREATE POLICY "Admins can read feedback"
ON public.feedback_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update feedback status" ON public.feedback_submissions;
CREATE POLICY "Admins can update feedback status"
ON public.feedback_submissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()));
