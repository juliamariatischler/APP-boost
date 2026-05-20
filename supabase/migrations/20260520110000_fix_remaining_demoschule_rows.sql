-- Hotfix: previous DemoSchule -> BoostSchule migration was recorded as applied,
-- but the live database still contains DemoSchule in code-login school data.

UPDATE public.profiles
SET school = 'BoostSchule'
WHERE school = 'DemoSchule';

UPDATE public.schools
SET name = 'BoostSchule'
WHERE lower(name) = lower('DemoSchule');
