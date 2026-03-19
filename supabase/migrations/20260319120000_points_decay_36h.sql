-- Update lightning decay logic:
-- - decay only after 36h inactivity
-- - warn once in the 2h window before decay

CREATE OR REPLACE FUNCTION public.apply_daily_points_decay()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_now timestamptz := now();
  v_points integer := 0;
  v_last_activity_at timestamptz;
  v_last_decay_at timestamptz;
  v_warning_sent_at timestamptz;
  v_reference_at timestamptz;
  v_next_decay_at timestamptz;
  v_decayed integer := 0;
  v_should_warn boolean := false;
  v_minutes_until_decay integer := 0;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  SELECT
    COALESCE(points, 0),
    last_activity_at,
    points_decay_last_applied_at,
    points_decay_warning_sent_at
  INTO
    v_points,
    v_last_activity_at,
    v_last_decay_at,
    v_warning_sent_at
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'decayed_points', 0,
      'should_warn', false,
      'minutes_until_decay', 0
    );
  END IF;

  v_last_activity_at := COALESCE(v_last_activity_at, v_now);
  v_reference_at := GREATEST(v_last_activity_at, COALESCE(v_last_decay_at, v_last_activity_at));
  v_next_decay_at := v_reference_at + interval '36 hours';

  IF v_points > 0 AND v_now >= v_next_decay_at THEN
    UPDATE public.profiles
    SET points = GREATEST(COALESCE(points, 0) - 1, 0),
        points_decay_last_applied_at = v_now,
        points_decay_warning_sent_at = NULL,
        updated_at = now()
    WHERE id = v_uid;

    v_decayed := 1;

    -- next decay countdown starts after this decay event if still inactive
    v_reference_at := GREATEST(v_last_activity_at, v_now);
    v_next_decay_at := v_reference_at + interval '36 hours';
  END IF;

  v_minutes_until_decay := GREATEST(CEIL(EXTRACT(EPOCH FROM (v_next_decay_at - v_now)) / 60.0)::int, 0);

  IF v_points > 0
     AND v_now >= (v_next_decay_at - interval '2 hours')
     AND v_now < v_next_decay_at
     AND (v_warning_sent_at IS NULL OR v_warning_sent_at < v_reference_at)
  THEN
    UPDATE public.profiles
    SET points_decay_warning_sent_at = v_now,
        updated_at = now()
    WHERE id = v_uid;

    v_should_warn := true;
  END IF;

  RETURN jsonb_build_object(
    'decayed_points', v_decayed,
    'should_warn', v_should_warn,
    'minutes_until_decay', v_minutes_until_decay,
    'next_decay_at', v_next_decay_at
  );
END;
$$;
