-- Add server-side guardrails for point increments and reward redemption requests.

CREATE TABLE IF NOT EXISTS public.point_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points > 0),
  source text NOT NULL DEFAULT 'legacy_increment',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_point_awards_user_created
  ON public.point_awards (user_id, created_at DESC);

ALTER TABLE public.point_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own point awards" ON public.point_awards;
CREATE POLICY "Users can read own point awards"
ON public.point_awards
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read point awards" ON public.point_awards;
CREATE POLICY "Admins can read point awards"
ON public.point_awards
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND (
    NOT public.is_demo_user(auth.uid())
    OR public.is_demo_profile(user_id)
  )
);

CREATE OR REPLACE FUNCTION public.increment_points(points_to_add integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_awarded_today integer;
  v_daily_cap constant integer := 150;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  IF points_to_add < 1 OR points_to_add > 50 THEN
    RAISE EXCEPTION 'Invalid points value: must be between 1 and 50';
  END IF;

  SELECT COALESCE(SUM(points), 0)::integer
  INTO v_awarded_today
  FROM public.point_awards
  WHERE user_id = v_user_id
    AND created_at >= date_trunc('day', now());

  IF v_awarded_today + points_to_add > v_daily_cap THEN
    RAISE EXCEPTION 'Daily points limit reached';
  END IF;

  INSERT INTO public.point_awards (user_id, points, source)
  VALUES (v_user_id, points_to_add, 'legacy_increment');

  UPDATE public.profiles
  SET points = points + points_to_add,
      updated_at = now()
  WHERE id = v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_points(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_points(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_reward_redemption(p_reward_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reward public.reward_items%ROWTYPE;
  v_points integer;
  v_redemption_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  SELECT * INTO v_reward
  FROM public.reward_items
  WHERE id = p_reward_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward not found or inactive';
  END IF;

  SELECT COALESCE(points, 0)
  INTO v_points
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_points < v_reward.threshold THEN
    RAISE EXCEPTION 'Not enough points for this reward';
  END IF;

  SELECT id INTO v_redemption_id
  FROM public.reward_redemptions
  WHERE user_id = v_user_id
    AND reward_id = p_reward_id
    AND status = 'requested'
  ORDER BY requested_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_redemption_id;
  END IF;

  INSERT INTO public.reward_redemptions (user_id, reward_id, status)
  VALUES (v_user_id, p_reward_id, 'requested')
  RETURNING id INTO v_redemption_id;

  RETURN v_redemption_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_reward_redemption(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_reward_redemption(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can create own reward redemptions" ON public.reward_redemptions;
