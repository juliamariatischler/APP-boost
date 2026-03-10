-- Daily lightning decay for inactive days.
-- Rule: per elapsed day without activity, 1 point decays (min 0).

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS points_decay_checked_at date DEFAULT CURRENT_DATE;

CREATE OR REPLACE FUNCTION public.apply_daily_points_decay()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_today date := CURRENT_DATE;
  v_current_points integer := 0;
  v_checked_at date;
  v_days_elapsed integer := 0;
  v_active_days integer := 0;
  v_decay_days integer := 0;
  v_decay_points integer := 0;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  SELECT COALESCE(points, 0), points_decay_checked_at
  INTO v_current_points, v_checked_at
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_checked_at IS NULL THEN
    UPDATE public.profiles
    SET points_decay_checked_at = v_today,
        updated_at = now()
    WHERE id = v_uid;
    RETURN 0;
  END IF;

  IF v_checked_at >= v_today THEN
    RETURN 0;
  END IF;

  v_days_elapsed := (v_today - v_checked_at);

  SELECT COUNT(DISTINCT dr.date)
  INTO v_active_days
  FROM public.daily_results dr
  WHERE dr.user_id = v_uid
    AND dr.date > v_checked_at
    AND dr.date <= v_today
    AND (
      COALESCE(dr.steps, 0) > 0
      OR COALESCE(dr.jumping_jacks, 0) > 0
      OR COALESCE(dr.push_ups, 0) > 0
      OR COALESCE(dr.squats, 0) > 0
      OR COALESCE(dr.planks, 0) > 0
      OR COALESCE(dr.sit_ups, 0) > 0
    );

  v_decay_days := GREATEST(v_days_elapsed - v_active_days, 0);
  v_decay_points := LEAST(v_current_points, v_decay_days);

  UPDATE public.profiles
  SET points = GREATEST(COALESCE(points, 0) - v_decay_points, 0),
      points_decay_checked_at = v_today,
      updated_at = now()
  WHERE id = v_uid;

  RETURN v_decay_points;
END;
$$;
