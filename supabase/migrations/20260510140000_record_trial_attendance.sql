-- Records that a student attended a trial session and awards points (idempotent).

CREATE OR REPLACE FUNCTION public.record_trial_attendance(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_status text;
  v_session record;
  v_is_highlight boolean;
  v_points integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT ts.*, c.sport_type, ts.end_time
  INTO v_session
  FROM public.trial_sessions ts
  LEFT JOIN public.clubs c ON c.id = ts.club_id
  WHERE ts.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Check if already attended
  SELECT status INTO v_existing_status
  FROM public.trial_registrations
  WHERE user_id = v_user_id AND session_id = p_session_id;

  IF v_existing_status = 'attended' THEN
    RETURN jsonb_build_object('status', 'already_attended', 'points_awarded', 0);
  END IF;

  -- Highlight = end_time after 17:30
  v_is_highlight := v_session.end_time IS NOT NULL AND v_session.end_time > '17:30:00';
  v_points := CASE WHEN v_is_highlight THEN 25 ELSE 10 END;

  -- Upsert registration as attended
  INSERT INTO public.trial_registrations (user_id, session_id, status)
  VALUES (v_user_id, p_session_id, 'attended')
  ON CONFLICT (user_id, session_id)
  DO UPDATE SET status = 'attended', updated_at = now();

  -- Award points
  UPDATE public.profiles
  SET points = points + v_points,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('status', 'ok', 'points_awarded', v_points);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_trial_attendance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_trial_attendance(uuid) TO authenticated;
