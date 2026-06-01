-- Normalisiert profiles.class (Freitextfeld) auf Großbuchstaben ohne Leerzeichen.
-- Betrifft alte Profile ohne class_id (old-system users).

UPDATE public.profiles
SET class = upper(replace(trim(class), ' ', ''))
WHERE class IS NOT NULL
  AND class != upper(replace(trim(class), ' ', ''));

NOTIFY pgrst, 'reload schema';
