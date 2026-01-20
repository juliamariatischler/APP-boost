-- Create increment_points function
CREATE OR REPLACE FUNCTION public.increment_points(user_id_param UUID, points_to_add INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET points = points + points_to_add,
      updated_at = now()
  WHERE id = user_id_param;
END;
$$;