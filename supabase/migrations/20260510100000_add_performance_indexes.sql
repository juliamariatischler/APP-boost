-- Performance indexes for concurrent dashboard and leaderboard queries

-- Speeds up: Dashboard load, ClassLeaderboard, all class/school filters
CREATE INDEX IF NOT EXISTS idx_profiles_class_school_points
  ON public.profiles(class, school, points DESC)
  WHERE class IS NOT NULL AND school IS NOT NULL;

-- Speeds up: Dashboard weekly progress, gamification queries
CREATE INDEX IF NOT EXISTS idx_daily_results_user_date
  ON public.daily_results(user_id, date DESC);

-- Speeds up: Teacher access control checks in RPCs
CREATE INDEX IF NOT EXISTS idx_teacher_class_access_composite
  ON public.teacher_class_access(teacher_id, class_id);
