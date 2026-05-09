-- Add a simple 1-5 star rating to in-app feedback.

ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS rating integer CHECK (rating BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_rating_created
  ON public.feedback_submissions (rating, created_at DESC);
