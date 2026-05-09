-- Award a monthly class-ranking bonus when the class quest goal is reached.

CREATE TABLE IF NOT EXISTS public.class_quest_bonus_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school text NOT NULL,
  class text NOT NULL,
  month_start date NOT NULL,
  goal integer NOT NULL DEFAULT 1000,
  achieved_amount integer NOT NULL DEFAULT 0,
  reward_points integer NOT NULL DEFAULT 2000,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school, class, month_start)
);

ALTER TABLE public.class_quest_bonus_awards
  ALTER COLUMN reward_points SET DEFAULT 2000;

UPDATE public.class_quest_bonus_awards
SET reward_points = 2000
WHERE reward_points = 200;

ALTER TABLE public.class_quest_bonus_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read class quest bonus awards" ON public.class_quest_bonus_awards;
CREATE POLICY "Authenticated users can read class quest bonus awards"
ON public.class_quest_bonus_awards
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage class quest bonus awards" ON public.class_quest_bonus_awards;
CREATE POLICY "Admins manage class quest bonus awards"
ON public.class_quest_bonus_awards
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_class_quest_bonus_awards_month_class
  ON public.class_quest_bonus_awards (month_start, school, class);

CREATE OR REPLACE FUNCTION public.award_class_quest_bonus_if_complete(
  p_month_start date DEFAULT date_trunc('month', timezone('Europe/Vienna', now()))::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_class text;
  v_school text;
  v_goal integer := 1000;
  v_reward integer := 2000;
  v_total integer := 0;
  v_month_start date := date_trunc(
    'month',
    COALESCE(p_month_start, timezone('Europe/Vienna', now())::date)::timestamp
  )::date;
  v_month_end date := (
    date_trunc(
      'month',
      COALESCE(p_month_start, timezone('Europe/Vienna', now())::date)::timestamp
    ) + interval '1 month'
  )::date;
  v_inserted_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.class, p.school
  INTO v_class, v_school
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_class IS NULL OR v_school IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Keine Klasse gefunden');
  END IF;

  SELECT COALESCE(SUM(COALESCE(dr.squats, 0)), 0)::integer
  INTO v_total
  FROM public.profiles p
  LEFT JOIN public.daily_results dr
    ON dr.user_id = p.id
   AND dr.date >= v_month_start
   AND dr.date < v_month_end
  WHERE p.class = v_class
    AND p.school = v_school;

  IF v_total < v_goal THEN
    RETURN jsonb_build_object(
      'ok', true,
      'awarded', false,
      'already_awarded', false,
      'class_total', v_total,
      'goal', v_goal,
      'reward_points', v_reward
    );
  END IF;

  INSERT INTO public.class_quest_bonus_awards (
    school,
    class,
    month_start,
    goal,
    achieved_amount,
    reward_points
  )
  VALUES (
    v_school,
    v_class,
    v_month_start,
    v_goal,
    v_total,
    v_reward
  )
  ON CONFLICT (school, class, month_start) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'awarded', v_inserted_count > 0,
    'already_awarded', v_inserted_count = 0,
    'class_total', v_total,
    'goal', v_goal,
    'reward_points', v_reward
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_class_rankings_with_quest_bonus(
  p_month_start date DEFAULT date_trunc('month', timezone('Europe/Vienna', now()))::date
)
RETURNS TABLE (
  school text,
  class text,
  total_flashes integer,
  student_count integer,
  sort_order integer,
  quest_bonus_points integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_value AS (
    SELECT date_trunc(
      'month',
      COALESCE(p_month_start, timezone('Europe/Vienna', now())::date)::timestamp
    )::date AS month_start
  ),
  profile_counts AS (
    SELECT
      p.school,
      p.class,
      COUNT(*)::integer AS profile_student_count
    FROM public.profiles p
    WHERE p.school IS NOT NULL
      AND p.class IS NOT NULL
    GROUP BY p.school, p.class
  ),
  monthly_class_totals AS (
    SELECT
      p.school,
      p.class,
      COALESCE(SUM(COALESCE(dr.squats, 0)), 0)::integer AS monthly_squats
    FROM public.profiles p
    CROSS JOIN month_value mv
    LEFT JOIN public.daily_results dr
      ON dr.user_id = p.id
     AND dr.date >= mv.month_start
     AND dr.date < (mv.month_start + interval '1 month')::date
    WHERE p.school IS NOT NULL
      AND p.class IS NOT NULL
    GROUP BY p.school, p.class
  ),
  bonus_candidates AS (
    SELECT
      b.school,
      b.class,
      b.reward_points
    FROM public.class_quest_bonus_awards b
    CROSS JOIN month_value mv
    WHERE b.month_start = mv.month_start
    UNION ALL
    SELECT
      m.school,
      m.class,
      2000 AS reward_points
    FROM monthly_class_totals m
    WHERE m.monthly_squats >= 1000
  ),
  bonus AS (
    SELECT
      bc.school,
      bc.class,
      COALESCE(MAX(bc.reward_points), 0)::integer AS bonus_points
    FROM bonus_candidates bc
    GROUP BY bc.school, bc.class
  ),
  classes AS (
    SELECT
      r.school,
      r.class,
      r.total_flashes,
      r.student_count,
      r.sort_order,
      true AS is_active
    FROM public.presentation_class_rankings r
    UNION
    SELECT
      b.school,
      b.class,
      0 AS total_flashes,
      COALESCE(pc.profile_student_count, 0) AS student_count,
      9999 AS sort_order,
      true AS is_active
    FROM bonus b
    LEFT JOIN profile_counts pc
      ON pc.school = b.school
     AND pc.class = b.class
  )
  SELECT
    c.school,
    c.class,
    (COALESCE(MAX(c.total_flashes), 0) + COALESCE(MAX(b.bonus_points), 0))::integer AS total_flashes,
    GREATEST(COALESCE(MAX(c.student_count), 0), COALESCE(MAX(pc.profile_student_count), 0), 1)::integer AS student_count,
    MIN(c.sort_order)::integer AS sort_order,
    COALESCE(MAX(b.bonus_points), 0)::integer AS quest_bonus_points
  FROM classes c
  LEFT JOIN bonus b
    ON b.school = c.school
   AND b.class = c.class
  LEFT JOIN profile_counts pc
    ON pc.school = c.school
   AND pc.class = c.class
  WHERE c.is_active = true
  GROUP BY c.school, c.class
  ORDER BY total_flashes DESC, sort_order ASC, c.class ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.award_class_quest_bonus_if_complete(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_class_quest_bonus_if_complete(date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_class_rankings_with_quest_bonus(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_class_rankings_with_quest_bonus(date) TO authenticated;
