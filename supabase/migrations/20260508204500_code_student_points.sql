-- Points support for QR/code-login students.
-- Classic Supabase-auth students keep using public.profiles.points.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

UPDATE public.students s
SET points = GREATEST(
  COALESCE(s.points, 0),
  COALESCE(calc.calculated_points, 0)
)
FROM (
  SELECT
    dr.user_id,
    SUM(
      (CASE WHEN COALESCE(dr.push_ups, 0) >= 10 THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(dr.squats, 0) >= 10 THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(dr.planks, 0) >= 10 THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(dr.sit_ups, 0) >= 25 THEN 1 ELSE 0 END) +
      (CASE WHEN COALESCE(dr.jumping_jacks, 0) >= 40 THEN 1 ELSE 0 END) +
      (CASE
        WHEN COALESCE(dr.steps, 0) >= 3000
          AND COALESCE(dr.push_ups, 0) >= 10
          AND COALESCE(dr.squats, 0) >= 10
          AND COALESCE(dr.planks, 0) >= 10
          AND COALESCE(dr.sit_ups, 0) >= 25
          AND COALESCE(dr.jumping_jacks, 0) >= 40
        THEN 20 ELSE 0
      END)
    )::integer AS calculated_points
  FROM public.daily_results dr
  GROUP BY dr.user_id
) calc
WHERE calc.user_id = s.id;

CREATE OR REPLACE FUNCTION public.get_code_student_dashboard(
  p_device_id text,
  p_session_token text,
  p_week_start date,
  p_week_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.active_sessions%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_results jsonb;
BEGIN
  SELECT * INTO v_session
  FROM public.active_sessions
  WHERE device_id = trim(p_device_id)
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active = true
    AND user_type = 'student'
    AND COALESCE(expires_at, now() + interval '1 day') > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Schueler-Session');
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = v_session.user_id
    AND active = true
    AND deactivated_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Schuelerprofil ist nicht aktiv');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.date), '[]'::jsonb)
  INTO v_results
  FROM (
    SELECT
      date,
      jumping_jacks,
      push_ups,
      squats,
      planks,
      sit_ups,
      steps,
      steps_tracking_active,
      updated_at
    FROM public.daily_results
    WHERE user_id = v_student.id
      AND date >= p_week_start
      AND date <= p_week_end
  ) r;

  RETURN jsonb_build_object(
    'points', COALESCE(v_student.points, 0),
    'daily_results', v_results
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_code_student_counter_results(
  p_device_id text,
  p_session_token text,
  p_date date,
  p_jumping_jacks_delta integer DEFAULT 0,
  p_push_ups_delta integer DEFAULT 0,
  p_squats_delta integer DEFAULT 0,
  p_planks_delta integer DEFAULT 0,
  p_sit_ups_delta integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.active_sessions%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_existing public.daily_results%ROWTYPE;
  v_prev_completed integer := 0;
  v_next_completed integer := 0;
  v_prev_goal_complete boolean := false;
  v_next_goal_complete boolean := false;
  v_points_to_add integer := 0;
  v_awarded_today integer := 0;
  v_daily_cap integer := 75;
  v_next_jumping_jacks integer;
  v_next_push_ups integer;
  v_next_squats integer;
  v_next_planks integer;
  v_next_sit_ups integer;
  v_steps integer;
BEGIN
  SELECT * INTO v_session
  FROM public.active_sessions
  WHERE device_id = trim(p_device_id)
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active = true
    AND user_type = 'student'
    AND COALESCE(expires_at, now() + interval '1 day') > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Schueler-Session');
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = v_session.user_id
    AND active = true
    AND deactivated_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Schuelerprofil ist nicht aktiv');
  END IF;

  SELECT * INTO v_existing
  FROM public.daily_results
  WHERE user_id = v_student.id
    AND date = p_date
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.daily_results (user_id, date)
    VALUES (v_student.id, p_date)
    RETURNING * INTO v_existing;
  END IF;

  v_steps := COALESCE(v_existing.steps, 0);
  v_prev_completed :=
    (CASE WHEN COALESCE(v_existing.push_ups, 0) >= 10 THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(v_existing.squats, 0) >= 10 THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(v_existing.planks, 0) >= 10 THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(v_existing.sit_ups, 0) >= 25 THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(v_existing.jumping_jacks, 0) >= 40 THEN 1 ELSE 0 END);

  v_next_jumping_jacks := GREATEST(0, COALESCE(v_existing.jumping_jacks, 0) + GREATEST(COALESCE(p_jumping_jacks_delta, 0), 0));
  v_next_push_ups := GREATEST(0, COALESCE(v_existing.push_ups, 0) + GREATEST(COALESCE(p_push_ups_delta, 0), 0));
  v_next_squats := GREATEST(0, COALESCE(v_existing.squats, 0) + GREATEST(COALESCE(p_squats_delta, 0), 0));
  v_next_planks := GREATEST(0, COALESCE(v_existing.planks, 0) + GREATEST(COALESCE(p_planks_delta, 0), 0));
  v_next_sit_ups := GREATEST(0, COALESCE(v_existing.sit_ups, 0) + GREATEST(COALESCE(p_sit_ups_delta, 0), 0));

  v_next_completed :=
    (CASE WHEN v_next_push_ups >= 10 THEN 1 ELSE 0 END) +
    (CASE WHEN v_next_squats >= 10 THEN 1 ELSE 0 END) +
    (CASE WHEN v_next_planks >= 10 THEN 1 ELSE 0 END) +
    (CASE WHEN v_next_sit_ups >= 25 THEN 1 ELSE 0 END) +
    (CASE WHEN v_next_jumping_jacks >= 40 THEN 1 ELSE 0 END);

  v_prev_goal_complete :=
    v_steps >= 3000
    AND COALESCE(v_existing.push_ups, 0) >= 10
    AND COALESCE(v_existing.squats, 0) >= 10
    AND COALESCE(v_existing.planks, 0) >= 10
    AND COALESCE(v_existing.sit_ups, 0) >= 25
    AND COALESCE(v_existing.jumping_jacks, 0) >= 40;

  v_next_goal_complete :=
    v_steps >= 3000
    AND v_next_push_ups >= 10
    AND v_next_squats >= 10
    AND v_next_planks >= 10
    AND v_next_sit_ups >= 25
    AND v_next_jumping_jacks >= 40;

  UPDATE public.daily_results
  SET jumping_jacks = v_next_jumping_jacks,
      push_ups = v_next_push_ups,
      squats = v_next_squats,
      planks = v_next_planks,
      sit_ups = v_next_sit_ups,
      updated_at = now()
  WHERE id = v_existing.id;

  v_points_to_add := GREATEST(0, v_next_completed - v_prev_completed);
  IF NOT v_prev_goal_complete AND v_next_goal_complete THEN
    v_points_to_add := v_points_to_add + 20;
  END IF;

  IF v_points_to_add > 0 THEN
    SELECT COALESCE(SUM(points), 0)::integer
    INTO v_awarded_today
    FROM public.point_awards
    WHERE user_id = v_student.id
      AND created_at >= date_trunc('day', now());

    IF v_awarded_today + v_points_to_add > v_daily_cap THEN
      v_points_to_add := GREATEST(0, v_daily_cap - v_awarded_today);
    END IF;
  END IF;

  IF v_points_to_add > 0 THEN
    INSERT INTO public.point_awards (user_id, points, source)
    VALUES (v_student.id, v_points_to_add, 'code_student_daily_counter');

    UPDATE public.students
    SET points = COALESCE(points, 0) + v_points_to_add
    WHERE id = v_student.id
    RETURNING * INTO v_student;
  END IF;

  RETURN jsonb_build_object(
    'points_awarded', v_points_to_add,
    'total_points', COALESCE(v_student.points, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_code_student_dashboard(text, text, date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_code_student_counter_results(text, text, date, integer, integer, integer, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_code_student_dashboard(text, text, date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_code_student_counter_results(text, text, date, integer, integer, integer, integer, integer) TO anon, authenticated;
