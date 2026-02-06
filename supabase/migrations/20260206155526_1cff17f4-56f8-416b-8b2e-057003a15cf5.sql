-- Add RLS policy to allow authenticated users to view basic profile information
-- This is needed for social features like challenges, leaderboards, and friend comparisons

CREATE POLICY "Authenticated users can view basic profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Note: The profiles table only contains non-sensitive fields (id, username, points, school, class)
-- No email, health data, or private information is stored in this table