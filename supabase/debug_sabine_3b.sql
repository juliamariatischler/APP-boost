-- Diagnose: Sabine, 3b, Boostschule
-- ─────────────────────────────────────────────────────────

-- 1) Wer ist Sabine in public.students (QR-Login)?
SELECT 'students' AS quelle, id, display_name, class_id
FROM public.students
WHERE lower(display_name) LIKE '%sabine%';

-- 2) Wer ist Sabine in public.profiles (Auth-Login)?
SELECT 'profiles' AS quelle, id, username, school, class, school_id, class_id, role
FROM public.profiles
WHERE lower(username) LIKE '%sabine%'
   OR lower(display_name) LIKE '%sabine%';

-- 3) Klasse 3b an der Boostschule
SELECT cl.id AS class_id, cl.name AS klasse, sc.name AS schule, sc.id AS school_id
FROM public.classes cl
JOIN public.schools sc ON sc.id = cl.school_id
WHERE lower(cl.name) LIKE '%3b%'
  AND lower(sc.name) LIKE '%boost%';

-- 4) Was steckt hinter der UUID 1f760475-4ce8-4ab8-accd-947e9dcb434b?
SELECT 'students' AS quelle, id, display_name FROM public.students
WHERE id = '1f760475-4ce8-4ab8-accd-947e9dcb434b'
UNION ALL
SELECT 'profiles', id, username FROM public.profiles
WHERE id = '1f760475-4ce8-4ab8-accd-947e9dcb434b';

-- 5) Hat diese UUID überhaupt daily_results (egal welches Datum)?
SELECT count(*) AS eintraege, min(date) AS erstes, max(date) AS letztes
FROM public.daily_results
WHERE user_id = '1f760475-4ce8-4ab8-accd-947e9dcb434b';

-- 6) daily_results für Sabine (alle IDs aus Schritt 1+2) im Zeitraum
SELECT dr.*
FROM public.daily_results dr
WHERE dr.date BETWEEN '2026-05-28' AND '2026-05-31'
  AND dr.user_id IN (
    SELECT id FROM public.students WHERE lower(display_name) LIKE '%sabine%'
    UNION
    SELECT id FROM public.profiles  WHERE lower(username)     LIKE '%sabine%'
                                       OR lower(display_name) LIKE '%sabine%'
  );
