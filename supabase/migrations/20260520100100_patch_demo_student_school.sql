-- Ensure demo student profile uses BoostSchule/4a (in case the data migration from
-- 20260510150100 didn't run and the profile still has the old DemoSchule value).
UPDATE public.profiles
SET school = 'BoostSchule', class = '4a'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN ('demo@boost-challenge.de', 'demo-lehrkraft@boost-challenge.de')
)
AND (school IS DISTINCT FROM 'BoostSchule' OR class IS DISTINCT FROM '4a');
