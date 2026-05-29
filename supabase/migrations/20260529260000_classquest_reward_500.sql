-- Update ClassQuest weekly reward from 200 to 500 Blitze

CREATE OR REPLACE FUNCTION public.award_class_quest_bonus_if_complete(
  p_week_start date DEFAULT date_trunc('week', timezone('Europe/Vienna', now()))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_class          text;
  v_school         text;
  v_goal           integer := 1000;
  v_reward         integer := 500;
  v_total          integer := 0;
  v_wstart         date := date_trunc(
    'week',
    COALESCE(p_week_start, timezone('Europe/Vienna', now())::date)::timestamp
  )::date;
  v_wend           date := v_wstart + 7;
  v_inserted_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT p.class, p.school INTO v_class, v_school
  FROM public.profiles p WHERE p.id = v_user_id;

  IF v_class IS NULL OR v_school IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Keine Klasse gefunden');
  END IF;

  SELECT COALESCE(SUM(
    CASE public.get_quest_exercise_index(v_wstart)
      WHEN 0 THEN COALESCE(dr.squats, 0)
      WHEN 1 THEN COALESCE(dr.jumping_jacks, 0)
      WHEN 2 THEN COALESCE(dr.push_ups, 0)
      WHEN 3 THEN COALESCE(dr.planks, 0)
      WHEN 4 THEN COALESCE(dr.sit_ups, 0)
      ELSE 0
    END
  ), 0)::integer
  INTO v_total
  FROM public.profiles p
  LEFT JOIN public.daily_results dr
    ON dr.user_id = p.id
   AND dr.date >= v_wstart
   AND dr.date <  v_wend
  WHERE p.class = v_class AND p.school = v_school;

  IF v_total < v_goal THEN
    RETURN jsonb_build_object(
      'ok', true, 'awarded', false, 'already_awarded', false,
      'class_total', v_total, 'goal', v_goal, 'reward_points', v_reward
    );
  END IF;

  INSERT INTO public.class_quest_bonus_awards
    (school, class, week_start, goal, achieved_amount, reward_points)
  VALUES
    (v_school, v_class, v_wstart, v_goal, v_total, v_reward)
  ON CONFLICT (school, class, week_start) WHERE week_start IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'awarded', v_inserted_count > 0,
    'already_awarded', v_inserted_count = 0,
    'class_total', v_total, 'goal', v_goal, 'reward_points', v_reward
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_class_quest_bonus_if_complete(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.award_class_quest_bonus_if_complete(date) TO authenticated;

-- Update rankings function: fallback reward_points for classes that hit the goal
CREATE OR REPLACE FUNCTION public.get_class_rankings_with_quest_bonus(
  p_week_start date DEFAULT date_trunc('week', timezone('Europe/Vienna', now()))::date
)
RETURNS TABLE (
  school            text,
  class             text,
  total_flashes     integer,
  student_count     integer,
  sort_order        integer,
  quest_bonus_points integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH week_value AS (
    SELECT date_trunc(
      'week',
      COALESCE(p_week_start, timezone('Europe/Vienna', now())::date)::timestamp
    )::date AS wstart
  ),
  profile_counts AS (
    SELECT p.school, p.class, COUNT(*)::integer AS profile_student_count
    FROM public.profiles p
    WHERE p.school IS NOT NULL AND p.class IS NOT NULL
    GROUP BY p.school, p.class
  ),
  weekly_class_totals AS (
    SELECT
      p.school,
      p.class,
      COALESCE(SUM(
        CASE public.get_quest_exercise_index(wv.wstart)
          WHEN 0 THEN COALESCE(dr.squats, 0)
          WHEN 1 THEN COALESCE(dr.jumping_jacks, 0)
          WHEN 2 THEN COALESCE(dr.push_ups, 0)
          WHEN 3 THEN COALESCE(dr.planks, 0)
          WHEN 4 THEN COALESCE(dr.sit_ups, 0)
          ELSE 0
        END
      ), 0)::integer AS weekly_amount
    FROM public.profiles p
    CROSS JOIN week_value wv
    LEFT JOIN public.daily_results dr
      ON dr.user_id = p.id
     AND dr.date >= wv.wstart
     AND dr.date <  (wv.wstart + 7)
    WHERE p.school IS NOT NULL AND p.class IS NOT NULL
    GROUP BY p.school, p.class
  ),
  bonus_candidates AS (
    SELECT b.school, b.class, b.reward_points
    FROM public.class_quest_bonus_awards b
    CROSS JOIN week_value wv
    WHERE b.week_start = wv.wstart
    UNION ALL
    SELECT w.school, w.class, 500 AS reward_points
    FROM weekly_class_totals w
    WHERE w.weekly_amount >= 1000
  ),
  bonus AS (
    SELECT bc.school, bc.class, COALESCE(MAX(bc.reward_points), 0)::integer AS bonus_points
    FROM bonus_candidates bc
    GROUP BY bc.school, bc.class
  ),
  classes AS (
    SELECT r.school, r.class, r.total_flashes, r.student_count, r.sort_order, true AS is_active
    FROM public.presentation_class_rankings r
    UNION
    SELECT
      b.school, b.class,
      0 AS total_flashes,
      COALESCE(pc.profile_student_count, 0) AS student_count,
      9999 AS sort_order,
      true AS is_active
    FROM bonus b
    LEFT JOIN profile_counts pc ON pc.school = b.school AND pc.class = b.class
  )
  SELECT
    c.school,
    c.class,
    (COALESCE(MAX(c.total_flashes), 0) + COALESCE(MAX(b.bonus_points), 0))::integer AS total_flashes,
    GREATEST(COALESCE(MAX(c.student_count), 0), COALESCE(MAX(pc.profile_student_count), 0), 1)::integer AS student_count,
    MIN(c.sort_order)::integer AS sort_order,
    COALESCE(MAX(b.bonus_points), 0)::integer AS quest_bonus_points
  FROM classes c
  LEFT JOIN bonus b        ON b.school  = c.school  AND b.class  = c.class
  LEFT JOIN profile_counts pc ON pc.school = c.school AND pc.class = c.class
  WHERE c.is_active = true
  GROUP BY c.school, c.class
  ORDER BY total_flashes DESC, sort_order ASC, c.class ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_class_rankings_with_quest_bonus(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_class_rankings_with_quest_bonus(date) TO authenticated;

NOTIFY pgrst, 'reload schema';
