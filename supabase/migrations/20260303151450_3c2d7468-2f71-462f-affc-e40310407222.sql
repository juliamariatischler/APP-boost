
CREATE OR REPLACE FUNCTION public.increment_points(points_to_add integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;
  
  -- Validate points range
  IF points_to_add < 0 OR points_to_add > 100 THEN
    RAISE EXCEPTION 'Invalid points value: must be between 0 and 100';
  END IF;
  
  -- Only update the authenticated user's own profile
  UPDATE public.profiles
  SET points = points + points_to_add,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Drop the old 2-parameter version
DROP FUNCTION IF EXISTS public.increment_points(uuid, integer);
