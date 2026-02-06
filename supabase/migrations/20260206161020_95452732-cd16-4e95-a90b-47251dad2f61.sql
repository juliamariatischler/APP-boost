-- Fix: Add authorization checks to increment_points function
-- This prevents users from manipulating other users' points

CREATE OR REPLACE FUNCTION public.increment_points(user_id_param uuid, points_to_add integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to increment their own points
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;
  
  IF auth.uid() != user_id_param THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify other users points';
  END IF;
  
  -- Add reasonable limits to prevent abuse
  IF points_to_add < 0 OR points_to_add > 100 THEN
    RAISE EXCEPTION 'Invalid points value: must be between 0 and 100';
  END IF;
  
  UPDATE public.profiles
  SET points = points + points_to_add,
      updated_at = now()
  WHERE id = user_id_param;
END;
$$;