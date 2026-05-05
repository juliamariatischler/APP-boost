-- Aggregate monthly class quest progress without exposing raw classmate daily_results.
CREATE OR REPLACE FUNCTION public.get_class_quest_progress(
  p_month_start date DEFAULT date_trunc('month', timezone('Europe/Vienna', now()))::date
)
RETURNS TABLE (
  student_id uuid,
  username text,
  contribution integer,
  class_name text,
  school_name text,
  class_total integer,
  goal integer,
  rank_position integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class text;
  v_school text;
  v_goal integer := 1000;
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.class, p.school
  INTO v_class, v_school
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_class IS NULL OR v_school IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH students AS (
    SELECT p.id AS sid, p.username AS uname
    FROM public.profiles p
    WHERE p.class = v_class
      AND p.school = v_school
  ),
  contributions AS (
    SELECT
      s.sid,
      s.uname,
      COALESCE(SUM(COALESCE(dr.squats, 0)), 0)::integer AS amount
    FROM students s
    LEFT JOIN public.daily_results dr
      ON dr.user_id = s.sid
     AND dr.date >= v_month_start
     AND dr.date < v_month_end
    GROUP BY s.sid, s.uname
  ),
  totals AS (
    SELECT COALESCE(SUM(c.amount), 0)::integer AS total_amount
    FROM contributions c
  ),
  ranked AS (
    SELECT
      c.sid,
      c.uname,
      c.amount,
      row_number() OVER (ORDER BY c.amount DESC, c.uname ASC)::integer AS place
    FROM contributions c
  )
  SELECT
    r.sid,
    r.uname,
    r.amount,
    v_class,
    v_school,
    t.total_amount,
    v_goal,
    r.place
  FROM ranked r
  CROSS JOIN totals t
  ORDER BY r.amount DESC, r.uname ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_class_quest_progress(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_class_quest_progress(date) TO authenticated;
