-- ============================================================
-- Student progress tracking for the code-based login flow
-- Tables: student_daily_log, class_quests
-- RPCs:   log_exercise, get_student_stats,
--         get_class_leaderboard, get_school_ranking, get_class_quest
-- ============================================================

-- 1. One row per student per calendar day
CREATE TABLE IF NOT EXISTS public.student_daily_log (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id      uuid REFERENCES public.students(id)  ON DELETE CASCADE NOT NULL,
  class_id        uuid REFERENCES public.classes(id)   NOT NULL,
  school_id       uuid REFERENCES public.schools(id)   NOT NULL,
  log_date        date NOT NULL DEFAULT CURRENT_DATE,
  push_ups        int  NOT NULL DEFAULT 0,
  squats          int  NOT NULL DEFAULT 0,
  situps          int  NOT NULL DEFAULT 0,
  planks_seconds  int  NOT NULL DEFAULT 0,
  jumping_jacks   int  NOT NULL DEFAULT 0,
  points_today    int  NOT NULL DEFAULT 0,
  UNIQUE(student_id, log_date)
);

-- 2. Class-level quest / challenge
CREATE TABLE IF NOT EXISTS public.class_quests (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id       uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  title          text NOT NULL,
  exercise_type  text NOT NULL CHECK (exercise_type IN ('pushup','squat','situp','plank','jumping_jack')),
  target_reps    int  NOT NULL,
  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz NOT NULL,
  reward_points  int  NOT NULL DEFAULT 100,
  active         boolean DEFAULT true
);

ALTER TABLE public.student_daily_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_quests       ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sdl_student_date ON public.student_daily_log(student_id, log_date);
CREATE INDEX IF NOT EXISTS idx_sdl_class_date   ON public.student_daily_log(class_id,   log_date);
CREATE INDEX IF NOT EXISTS idx_cq_class_active  ON public.class_quests(class_id, active);


-- ============================================================
-- RPC: log_exercise
-- Called after each exercise session (reads localStorage keys).
-- Upserts today's log and awards points (daily cap: 300).
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_exercise(
  p_device_id      text,
  p_pushups        int DEFAULT 0,
  p_squats         int DEFAULT 0,
  p_situps         int DEFAULT 0,
  p_planks_seconds int DEFAULT 0,
  p_jumping_jacks  int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session  active_sessions%ROWTYPE;
  v_student  students%ROWTYPE;
  v_class    classes%ROWTYPE;
  v_school   schools%ROWTYPE;
  v_existing student_daily_log%ROWTYPE;
  v_today    date := CURRENT_DATE;
  v_pts      int;
  v_cap      int := 300;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE device_id = p_device_id AND active = true AND user_type = 'student'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Keine aktive Session'); END IF;

  SELECT * INTO v_student FROM students WHERE id = v_session.user_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Schüler nicht gefunden'); END IF;

  SELECT * INTO v_class  FROM classes WHERE id = v_student.class_id;
  SELECT * INTO v_school FROM schools WHERE id = v_class.school_id;

  -- Points formula (raw, before daily cap)
  v_pts :=
    LEAST(p_pushups       / 10, 30) * 3  -- max 90 pts pushups
    + LEAST(p_squats      / 10, 30) * 3  -- max 90 pts squats
    + LEAST(p_situps      / 10, 30) * 2  -- max 60 pts sit-ups
    + LEAST(p_planks_seconds / 30, 60) * 1  -- max 60 pts plank
    + LEAST(p_jumping_jacks / 20, 30) * 2;  -- max 60 pts JJ

  SELECT * INTO v_existing FROM student_daily_log
  WHERE student_id = v_student.id AND log_date = v_today;

  IF FOUND THEN
    -- Compute how many points are still allowed today
    v_pts := LEAST(v_pts, v_cap - v_existing.points_today);
    IF v_pts < 0 THEN v_pts := 0; END IF;

    UPDATE student_daily_log SET
      push_ups       = LEAST(push_ups       + p_pushups,        1000),
      squats         = LEAST(squats         + p_squats,         1000),
      situps         = LEAST(situps         + p_situps,         1000),
      planks_seconds = LEAST(planks_seconds + p_planks_seconds, 7200),
      jumping_jacks  = LEAST(jumping_jacks  + p_jumping_jacks,  2000),
      points_today   = LEAST(points_today   + v_pts,            v_cap)
    WHERE student_id = v_student.id AND log_date = v_today;
  ELSE
    v_pts := LEAST(v_pts, v_cap);
    INSERT INTO student_daily_log
      (student_id, class_id, school_id, log_date,
       push_ups, squats, situps, planks_seconds, jumping_jacks, points_today)
    VALUES
      (v_student.id, v_class.id, v_school.id, v_today,
       LEAST(p_pushups, 1000), LEAST(p_squats, 1000), LEAST(p_situps, 1000),
       LEAST(p_planks_seconds, 7200), LEAST(p_jumping_jacks, 2000),
       v_pts);
  END IF;

  RETURN jsonb_build_object('points_awarded', v_pts);
END;
$$;


-- ============================================================
-- RPC: get_student_stats
-- Weekly points, total points, active days, class rank, today's exercises
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_student_stats(p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session      active_sessions%ROWTYPE;
  v_student      students%ROWTYPE;
  v_week_start   date := date_trunc('week', CURRENT_DATE)::date;
  v_weekly_pts   int;
  v_total_pts    int;
  v_active_days  int;
  v_class_rank   int;
  v_today_row    student_daily_log%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE device_id = p_device_id AND active = true AND user_type = 'student'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Keine aktive Session'); END IF;

  SELECT * INTO v_student FROM students WHERE id = v_session.user_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Schüler nicht gefunden'); END IF;

  -- Aggregate stats
  SELECT COALESCE(SUM(points_today), 0) INTO v_weekly_pts
  FROM student_daily_log WHERE student_id = v_student.id AND log_date >= v_week_start;

  SELECT COALESCE(SUM(points_today), 0) INTO v_total_pts
  FROM student_daily_log WHERE student_id = v_student.id;

  SELECT COUNT(DISTINCT log_date) INTO v_active_days
  FROM student_daily_log
  WHERE student_id = v_student.id AND log_date >= v_week_start AND points_today > 0;

  -- Class rank this week
  SELECT rank INTO v_class_rank FROM (
    SELECT
      s.id,
      RANK() OVER (ORDER BY COALESCE(SUM(sdl.points_today), 0) DESC) AS rank
    FROM students s
    LEFT JOIN student_daily_log sdl
      ON sdl.student_id = s.id AND sdl.log_date >= v_week_start
    WHERE s.class_id = v_student.class_id AND s.active = true
    GROUP BY s.id
  ) sub WHERE id = v_student.id;

  -- Today's exercise log
  SELECT * INTO v_today_row FROM student_daily_log
  WHERE student_id = v_student.id AND log_date = CURRENT_DATE;

  RETURN jsonb_build_object(
    'weekly_points',      v_weekly_pts,
    'total_points',       v_total_pts,
    'active_days_week',   COALESCE(v_active_days, 0),
    'class_rank',         COALESCE(v_class_rank, 1),
    'today_push_ups',     COALESCE(v_today_row.push_ups,       0),
    'today_squats',       COALESCE(v_today_row.squats,         0),
    'today_situps',       COALESCE(v_today_row.situps,         0),
    'today_planks_sec',   COALESCE(v_today_row.planks_seconds, 0),
    'today_jumping_jacks',COALESCE(v_today_row.jumping_jacks,  0),
    'today_points',       COALESCE(v_today_row.points_today,   0)
  );
END;
$$;


-- ============================================================
-- RPC: get_class_leaderboard
-- Top 10 students in the same class, ranked by weekly points
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_class_leaderboard(p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session    active_sessions%ROWTYPE;
  v_student    students%ROWTYPE;
  v_week_start date := date_trunc('week', CURRENT_DATE)::date;
  v_result     jsonb;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE device_id = p_device_id AND active = true AND user_type = 'student'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Keine aktive Session'); END IF;

  SELECT * INTO v_student FROM students WHERE id = v_session.user_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Schüler nicht gefunden'); END IF;

  SELECT jsonb_agg(sub)
  INTO v_result
  FROM (
    SELECT
      s.id::text                                               AS student_id,
      s.display_name,
      COALESCE(SUM(sdl.points_today), 0)::int                 AS weekly_points,
      (s.id = v_student.id)                                   AS is_me,
      RANK() OVER (ORDER BY COALESCE(SUM(sdl.points_today), 0) DESC)::int AS rank
    FROM students s
    LEFT JOIN student_daily_log sdl
      ON sdl.student_id = s.id AND sdl.log_date >= v_week_start
    WHERE s.class_id = v_student.class_id AND s.active = true
    GROUP BY s.id, s.display_name
    ORDER BY weekly_points DESC
    LIMIT 10
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- ============================================================
-- RPC: get_school_ranking
-- All classes in the same school, ranked by weekly points
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_school_ranking(p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session    active_sessions%ROWTYPE;
  v_student    students%ROWTYPE;
  v_class      classes%ROWTYPE;
  v_week_start date := date_trunc('week', CURRENT_DATE)::date;
  v_result     jsonb;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE device_id = p_device_id AND active = true AND user_type = 'student'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Keine aktive Session'); END IF;

  SELECT * INTO v_student FROM students WHERE id = v_session.user_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Schüler nicht gefunden'); END IF;

  SELECT * INTO v_class FROM classes WHERE id = v_student.class_id;

  SELECT jsonb_agg(sub)
  INTO v_result
  FROM (
    SELECT
      c.id::text                                               AS class_id,
      c.name                                                   AS class_name,
      COALESCE(SUM(sdl.points_today), 0)::int                 AS weekly_points,
      (c.id = v_student.class_id)                             AS is_my_class,
      RANK() OVER (ORDER BY COALESCE(SUM(sdl.points_today), 0) DESC)::int AS rank
    FROM classes c
    LEFT JOIN student_daily_log sdl
      ON sdl.class_id = c.id AND sdl.log_date >= v_week_start
    WHERE c.school_id = v_class.school_id AND c.active = true
    GROUP BY c.id, c.name
    ORDER BY weekly_points DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- ============================================================
-- RPC: get_class_quest
-- Returns the active class quest + class-wide progress
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_class_quest(p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session      active_sessions%ROWTYPE;
  v_student      students%ROWTYPE;
  v_quest        class_quests%ROWTYPE;
  v_current_reps bigint;
  v_my_reps      bigint;
  v_pct          int;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE device_id = p_device_id AND active = true AND user_type = 'student'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Keine aktive Session'); END IF;

  SELECT * INTO v_student FROM students WHERE id = v_session.user_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Schüler nicht gefunden'); END IF;

  SELECT * INTO v_quest FROM class_quests
  WHERE class_id = v_student.class_id AND active = true AND ends_at > now()
  ORDER BY starts_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('quest', null);
  END IF;

  -- Class-wide reps (all students in this class during quest window)
  SELECT COALESCE(SUM(
    CASE v_quest.exercise_type
      WHEN 'pushup'       THEN sdl.push_ups
      WHEN 'squat'        THEN sdl.squats
      WHEN 'situp'        THEN sdl.situps
      WHEN 'plank'        THEN sdl.planks_seconds / 30
      WHEN 'jumping_jack' THEN sdl.jumping_jacks
      ELSE 0
    END
  ), 0) INTO v_current_reps
  FROM student_daily_log sdl
  JOIN students s ON s.id = sdl.student_id
  WHERE s.class_id = v_student.class_id
    AND sdl.log_date BETWEEN v_quest.starts_at::date AND v_quest.ends_at::date;

  -- My own reps
  SELECT COALESCE(SUM(
    CASE v_quest.exercise_type
      WHEN 'pushup'       THEN push_ups
      WHEN 'squat'        THEN squats
      WHEN 'situp'        THEN situps
      WHEN 'plank'        THEN planks_seconds / 30
      WHEN 'jumping_jack' THEN jumping_jacks
      ELSE 0
    END
  ), 0) INTO v_my_reps
  FROM student_daily_log
  WHERE student_id = v_student.id
    AND log_date BETWEEN v_quest.starts_at::date AND v_quest.ends_at::date;

  v_pct := LEAST(ROUND(v_current_reps::numeric / NULLIF(v_quest.target_reps, 0) * 100)::int, 100);

  RETURN jsonb_build_object(
    'quest', jsonb_build_object(
      'id',            v_quest.id,
      'title',         v_quest.title,
      'exercise_type', v_quest.exercise_type,
      'target_reps',   v_quest.target_reps,
      'current_reps',  v_current_reps,
      'my_reps',       v_my_reps,
      'percent',       v_pct,
      'ends_at',       v_quest.ends_at,
      'days_left',     GREATEST(CEIL(EXTRACT(EPOCH FROM (v_quest.ends_at - now())) / 86400)::int, 0),
      'reward_points', v_quest.reward_points
    )
  );
END;
$$;


-- ============================================================
-- Seed: one class quest per existing class
-- (10.000 Liegestütze – ends next Sunday at midnight)
-- ============================================================
INSERT INTO public.class_quests (class_id, title, exercise_type, target_reps, starts_at, ends_at, reward_points)
SELECT
  id,
  '10.000 Liegestütze gemeinsam',
  'pushup',
  10000,
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days' - interval '1 second',
  100
FROM public.classes
WHERE active = true
ON CONFLICT DO NOTHING;
