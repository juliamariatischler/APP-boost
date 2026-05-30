-- Add show_in_ranking flag to schools so demo schools can be hidden from Klassenranking.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS show_in_ranking boolean NOT NULL DEFAULT true;

-- BoostSchule is a demo school → hide from ranking
UPDATE public.schools
SET show_in_ranking = false
WHERE lower(name) = 'boostschule';

-- Rebuild ranking function: exclude schools with show_in_ranking = false
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

  -- New system: students table → classes → schools (QR/code students)
  -- Only schools with show_in_ranking = true
  new_student_totals AS (
    SELECT
      sc.name                                                           AS school,
      c.name                                                            AS class,
      COUNT(DISTINCT COALESCE(st.auth_user_id, st.id))::integer        AS student_count,
      COALESCE(SUM(COALESCE(p.points, st.points, 0)), 0)::integer      AS points_sum
    FROM public.students st
    JOIN public.classes  c  ON c.id  = st.class_id
    JOIN public.schools  sc ON sc.id = c.school_id
    LEFT JOIN public.profiles p ON p.id = st.auth_user_id
    WHERE st.deactivated_at IS NULL
      AND sc.show_in_ranking = true
    GROUP BY sc.name, c.name
  ),

  -- Old system: profiles with free-text class/school fields,
  -- excluding students already counted via the new system
  old_profile_totals AS (
    SELECT
      p.school,
      p.class,
      COUNT(*)::integer                       AS student_count,
      COALESCE(SUM(p.points), 0)::integer    AS points_sum
    FROM public.profiles p
    WHERE p.school IS NOT NULL
      AND p.class  IS NOT NULL
      AND COALESCE(p.role, 'student') = 'student'
      AND NOT EXISTS (
        SELECT 1 FROM public.students st
        WHERE st.auth_user_id = p.id
          AND st.deactivated_at IS NULL
      )
      -- Exclude schools marked as hidden from ranking
      AND NOT EXISTS (
        SELECT 1 FROM public.schools sc
        WHERE lower(sc.name) = lower(p.school)
          AND sc.show_in_ranking = false
      )
    GROUP BY p.school, p.class
  ),

  -- Merge both systems per (school, class)
  profile_counts AS (
    SELECT
      school,
      class,
      SUM(student_count)::integer  AS profile_student_count,
      SUM(points_sum)::integer     AS profile_points_sum
    FROM (
      SELECT school, class, student_count, points_sum FROM new_student_totals
      UNION ALL
      SELECT school, class, student_count, points_sum FROM old_profile_totals
    ) combined
    GROUP BY school, class
  ),

  -- Quest bonus (stored awards for this week)
  bonus AS (
    SELECT b.school, b.class, COALESCE(MAX(b.reward_points), 0)::integer AS bonus_points
    FROM public.class_quest_bonus_awards b
    CROSS JOIN week_value wv
    WHERE b.week_start = wv.wstart
    GROUP BY b.school, b.class
  ),

  -- Real classes: use live student-point sums
  real_classes AS (
    SELECT
      pc.school,
      pc.class,
      pc.profile_points_sum    AS total_flashes,
      pc.profile_student_count AS student_count,
      9999                     AS sort_order
    FROM profile_counts pc
  ),

  -- Demo/presentation classes: only those without any real student data
  demo_classes AS (
    SELECT r.school, r.class, r.total_flashes, r.student_count, r.sort_order
    FROM public.presentation_class_rankings r
    WHERE NOT EXISTS (
      SELECT 1 FROM profile_counts pc
      WHERE pc.school = r.school AND pc.class = r.class
    )
  ),

  all_classes AS (
    SELECT school, class, total_flashes, student_count, sort_order FROM real_classes
    UNION ALL
    SELECT school, class, total_flashes, student_count, sort_order FROM demo_classes
  )

  SELECT
    ac.school,
    ac.class,
    ac.total_flashes::integer,
    ac.student_count::integer,
    ac.sort_order::integer,
    COALESCE(b.bonus_points, 0)::integer AS quest_bonus_points
  FROM all_classes ac
  LEFT JOIN bonus b ON b.school = ac.school AND b.class = ac.class
  ORDER BY total_flashes DESC, sort_order ASC, ac.class ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_class_rankings_with_quest_bonus(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_class_rankings_with_quest_bonus(date) TO authenticated;

NOTIFY pgrst, 'reload schema';
