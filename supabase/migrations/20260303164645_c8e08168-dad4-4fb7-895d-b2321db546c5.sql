
-- Add rescue day tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS rescue_days_used integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_rescue_reset date NOT NULL DEFAULT CURRENT_DATE;

-- Create a function to calculate class participation percentage for today
CREATE OR REPLACE FUNCTION public.get_class_participation(p_class text, p_school text, p_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_students integer;
  active_students integer;
  participation_pct numeric;
BEGIN
  -- Count total students in class
  SELECT COUNT(*) INTO total_students
  FROM public.profiles
  WHERE class = p_class AND school = p_school;

  -- Count students who completed the daily challenge on given date
  SELECT COUNT(DISTINCT dr.user_id) INTO active_students
  FROM public.daily_results dr
  JOIN public.profiles p ON p.id = dr.user_id
  WHERE p.class = p_class 
    AND p.school = p_school
    AND dr.date = p_date
    AND COALESCE(dr.steps, 0) >= 3000
    AND COALESCE(dr.jumping_jacks, 0) >= 20
    AND COALESCE(dr.push_ups, 0) >= 20
    AND COALESCE(dr.squats, 0) >= 20
    AND COALESCE(dr.planks, 0) >= 30
    AND COALESCE(dr.sit_ups, 0) >= 20;

  IF total_students = 0 THEN
    participation_pct := 0;
  ELSE
    participation_pct := ROUND((active_students::numeric / total_students::numeric) * 100, 1);
  END IF;

  RETURN jsonb_build_object(
    'total_students', total_students,
    'active_students', active_students,
    'participation_pct', participation_pct,
    'streak_alive', participation_pct >= 70
  );
END;
$$;

-- Create a function to get class average points for energy rank comparison
CREATE OR REPLACE FUNCTION public.get_class_average_points(p_class text, p_school text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(AVG(points), 0)
  FROM public.profiles
  WHERE class = p_class AND school = p_school;
$$;
