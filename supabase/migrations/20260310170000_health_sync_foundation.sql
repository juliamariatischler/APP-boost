-- Foundation for scalable cross-platform health sync (Apple Health + Health Connect)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_source') THEN
    CREATE TYPE public.health_source AS ENUM ('apple_health', 'health_connect');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.health_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source public.health_source NOT NULL,
  last_synced_at timestamptz,
  cursor_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source)
);

ALTER TABLE public.health_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own health sync state" ON public.health_sync_state;
CREATE POLICY "Users can view their own health sync state"
  ON public.health_sync_state
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own health sync state" ON public.health_sync_state;
CREATE POLICY "Users can insert their own health sync state"
  ON public.health_sync_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own health sync state" ON public.health_sync_state;
CREATE POLICY "Users can update their own health sync state"
  ON public.health_sync_state
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.health_step_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source public.health_source NOT NULL,
  sample_start timestamptz NOT NULL,
  sample_end timestamptz NOT NULL,
  steps integer NOT NULL CHECK (steps >= 0),
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_health_step_samples_user_sample_start
  ON public.health_step_samples (user_id, sample_start DESC);

ALTER TABLE public.health_step_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own health step samples" ON public.health_step_samples;
CREATE POLICY "Users can view their own health step samples"
  ON public.health_step_samples
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own health step samples" ON public.health_step_samples;
CREATE POLICY "Users can insert their own health step samples"
  ON public.health_step_samples
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_health_steps(
  p_source public.health_source,
  p_sample_start timestamptz,
  p_sample_end timestamptz,
  p_steps integer,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_sample_date date;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_steps < 0 THEN
    RAISE EXCEPTION 'Invalid step count: %', p_steps;
  END IF;

  IF p_sample_end < p_sample_start THEN
    RAISE EXCEPTION 'Invalid sample range';
  END IF;

  INSERT INTO public.health_step_samples (
    user_id,
    source,
    sample_start,
    sample_end,
    steps,
    idempotency_key,
    metadata
  )
  VALUES (
    v_user_id,
    p_source,
    p_sample_start,
    p_sample_end,
    p_steps,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_sample_date := (p_sample_start AT TIME ZONE 'UTC')::date;

  INSERT INTO public.daily_results (user_id, date, steps, steps_tracking_active, steps_started_at)
  VALUES (v_user_id, v_sample_date, p_steps, true, p_sample_start)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    steps = COALESCE(public.daily_results.steps, 0) + EXCLUDED.steps,
    steps_tracking_active = true,
    updated_at = now();

  RETURN p_steps;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_health_sync_state(
  p_source public.health_source,
  p_last_synced_at timestamptz,
  p_cursor_token text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.health_sync_state (
    user_id,
    source,
    last_synced_at,
    cursor_token
  )
  VALUES (
    v_user_id,
    p_source,
    p_last_synced_at,
    p_cursor_token
  )
  ON CONFLICT (user_id, source)
  DO UPDATE SET
    last_synced_at = EXCLUDED.last_synced_at,
    cursor_token = EXCLUDED.cursor_token,
    updated_at = now();
END;
$$;

DROP TRIGGER IF EXISTS update_health_sync_state_updated_at ON public.health_sync_state;
CREATE TRIGGER update_health_sync_state_updated_at
  BEFORE UPDATE ON public.health_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
