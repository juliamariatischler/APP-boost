-- ============================================================
-- DIAGNOSE: Warum ist 1C noch ohne Lehrerin?
-- In Supabase Studio → SQL Editor ausführen
-- ============================================================

-- 1. Wie heißt die Schule EXAKT in der Datenbank?
SELECT id, name, active
FROM public.schools
WHERE lower(name) LIKE '%pestalozzi%' OR lower(name) LIKE '%bg%' OR lower(name) LIKE '%brg%'
ORDER BY name;

-- 2. Welche Klassen existieren für diese Schule?
SELECT c.id, c.name, c.active, s.name AS school_name
FROM public.classes c
JOIN public.schools s ON s.id = c.school_id
WHERE lower(s.name) LIKE '%pestalozzi%'
ORDER BY c.name;

-- 3. Wie lautet die E-Mail der Lehrerin EXAKT in auth.users?
SELECT id, email, created_at
FROM auth.users
WHERE lower(email) LIKE '%rogner%' OR lower(email) LIKE '%pestalozzi%' OR lower(raw_user_meta_data::text) LIKE '%roschine%';

-- 4. Welche teacher_class_assignments existieren für diese Schule?
SELECT
  tca.id,
  tca.teacher_id,
  u.email AS teacher_email,
  s.name  AS school_name,
  c.name  AS class_name
FROM public.teacher_class_assignments tca
JOIN public.schools s ON s.id = tca.school_id
JOIN public.classes c ON c.id = tca.class_id
JOIN auth.users     u ON u.id = tca.teacher_id
WHERE lower(s.name) LIKE '%pestalozzi%'
ORDER BY c.name;

-- 5. Wie viele 1C-Schüler gibt es (text-Felder)?
SELECT count(*), school, class
FROM public.profiles
WHERE lower(school) LIKE '%pestalozzi%'
GROUP BY school, class
ORDER BY class;

-- 6. Haben die 1C-Schüler bereits school_id/class_id gesetzt?
SELECT
  p.username,
  p.school,
  p.class,
  p.school_id,
  p.class_id
FROM public.profiles p
WHERE lower(p.school) LIKE '%pestalozzi%'
  AND upper(replace(trim(p.class),' ','')) = '1C'
  AND p.role = 'student'
LIMIT 30;
