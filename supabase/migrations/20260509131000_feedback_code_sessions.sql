-- Route all in-app feedback through one RPC so Supabase-auth users and
-- code-login sessions can submit feedback without direct table writes.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.feedback_submissions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS code_user_id uuid,
  ADD COLUMN IF NOT EXISTS code_user_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feedback_submissions_code_user_type_check'
      AND conrelid = 'public.feedback_submissions'::regclass
  ) THEN
    ALTER TABLE public.feedback_submissions
      ADD CONSTRAINT feedback_submissions_code_user_type_check
      CHECK (code_user_type IS NULL OR code_user_type IN ('student', 'teacher'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feedback_submissions_user_source_check'
      AND conrelid = 'public.feedback_submissions'::regclass
  ) THEN
    ALTER TABLE public.feedback_submissions
      ADD CONSTRAINT feedback_submissions_user_source_check
      CHECK (
        user_id IS NOT NULL
        OR (code_user_id IS NOT NULL AND code_user_type IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_code_user_created
  ON public.feedback_submissions (code_user_type, code_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_message text,
  p_rating integer DEFAULT NULL,
  p_page text DEFAULT 'profile',
  p_user_agent text DEFAULT NULL,
  p_device_id text DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_session public.active_sessions%ROWTYPE;
  v_message text := trim(coalesce(p_message, ''));
  v_page text := trim(coalesce(p_page, 'profile'));
BEGIN
  IF char_length(v_message) < 3 OR char_length(v_message) > 1000 THEN
    RETURN jsonb_build_object('error', 'Feedback muss zwischen 3 und 1000 Zeichen lang sein.');
  END IF;

  IF v_page = '' OR char_length(v_page) > 80 THEN
    RETURN jsonb_build_object('error', 'Ungueltige Feedback-Seite.');
  END IF;

  IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 5) THEN
    RETURN jsonb_build_object('error', 'Bewertung muss zwischen 1 und 5 liegen.');
  END IF;

  IF v_auth_user_id IS NOT NULL THEN
    INSERT INTO public.feedback_submissions (
      user_id,
      message,
      rating,
      page,
      user_agent
    )
    VALUES (
      v_auth_user_id,
      v_message,
      p_rating,
      v_page,
      p_user_agent
    );

    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT *
  INTO v_session
  FROM public.active_sessions
  WHERE device_id = trim(coalesce(p_device_id, ''))
    AND session_token_hash = encode(extensions.digest(coalesce(p_session_token, ''), 'sha256'), 'hex')
    AND active = true
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Session');
  END IF;

  UPDATE public.active_sessions
  SET last_seen_at = now()
  WHERE id = v_session.id;

  INSERT INTO public.feedback_submissions (
    code_user_id,
    code_user_type,
    message,
    rating,
    page,
    user_agent
  )
  VALUES (
    v_session.user_id,
    v_session.user_type,
    v_message,
    p_rating,
    v_page,
    p_user_agent
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_feedback(text, integer, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_feedback(text, integer, text, text, text, text) TO anon, authenticated;
