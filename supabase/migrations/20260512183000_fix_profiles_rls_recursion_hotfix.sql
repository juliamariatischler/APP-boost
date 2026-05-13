-- Hotfix: remove recursive profiles RLS self-lookups.
-- SECURITY DEFINER helper performs the current user's profile lookup outside
-- the profiles policy.

CREATE OR REPLACE FUNCTION public.profile_scope_matches_current_user(
  p_school text,
  p_class text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.school = p_school
      AND p.class = p_class
  );
$$;

GRANT EXECUTE ON FUNCTION public.profile_scope_matches_current_user(text, text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view scoped profile info" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view scoped profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR (
    public.is_demo_user(auth.uid())
    AND school = 'BoostSchule'
    AND class = '4a'
  )
  OR (
    NOT public.is_demo_user(auth.uid())
    AND public.profile_scope_matches_current_user(school, class)
  )
);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND (
    NOT public.is_demo_user(auth.uid())
    OR (school = 'BoostSchule' AND class = '4a')
  )
);

NOTIFY pgrst, 'reload schema';
