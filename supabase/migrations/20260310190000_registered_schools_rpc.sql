-- Public school dropdown source: schools that have at least one teacher account.

CREATE OR REPLACE FUNCTION public.get_registered_schools()
RETURNS TABLE (school text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT trim(p.school) AS school
  FROM public.profiles p
  JOIN public.user_roles ur
    ON ur.user_id = p.id
   AND ur.role = 'admin'::public.app_role
  WHERE trim(COALESCE(p.school, '')) <> ''
    AND lower(trim(p.school)) <> 'unbekannt'
  ORDER BY school;
$$;

GRANT EXECUTE ON FUNCTION public.get_registered_schools() TO anon;
GRANT EXECUTE ON FUNCTION public.get_registered_schools() TO authenticated;
