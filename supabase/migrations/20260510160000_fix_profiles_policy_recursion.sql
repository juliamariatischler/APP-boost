-- Fix infinite recursion in profiles RLS policy.
--
-- The previous policy had:
--   EXISTS (SELECT 1 FROM public.profiles viewer WHERE viewer.id = auth.uid() ...)
-- inside a SELECT policy ON public.profiles — PostgreSQL detects this as infinite
-- recursion (42P17) because evaluating the policy requires reading profiles,
-- which evaluates the policy again.
--
-- Fix: wrap the self-lookup in a SECURITY DEFINER function so it bypasses RLS.

CREATE OR REPLACE FUNCTION public.get_my_profile_scope()
RETURNS TABLE (school text, class text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.school, p.class
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile_scope() TO authenticated;

-- Re-create the scoped SELECT policy without the recursive subquery.
DROP POLICY IF EXISTS "Authenticated users can view scoped profile info" ON public.profiles;
CREATE POLICY "Authenticated users can view scoped profile info"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR (
    public.is_demo_user(auth.uid())
    AND school = 'BoostSchule'
    AND class = '4a'
  )
  OR (
    NOT public.is_demo_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.get_my_profile_scope() s
      WHERE s.school = profiles.school
        AND s.class = profiles.class
    )
  )
);
