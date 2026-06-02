-- ============================================================
-- DEBUG: Schüler in allen relevanten Tabellen suchen
-- In Supabase Studio → SQL Editor ausführen
-- ============================================================

-- 1. students Tabelle
SELECT
  'students' AS source,
  s.id::text AS id,
  s.display_name AS name,
  c.name AS class_name,
  sc.name AS school_name,
  s.auth_user_id::text,
  s.deactivated_at::text,
  s.active::text
FROM public.students s
LEFT JOIN public.classes c  ON c.id = s.class_id
LEFT JOIN public.schools sc ON sc.id = c.school_id
WHERE lower(s.display_name) IN ('rafaela','laura','lisa','anna','lena')
ORDER BY s.display_name;

-- 2. profiles Tabelle
SELECT
  'profiles' AS source,
  pr.id::text,
  pr.username AS name,
  c.name AS class_name,
  sc.name AS school_name,
  pr.role,
  pr.school AS school_text,
  pr.points::text
FROM public.profiles pr
LEFT JOIN public.classes c  ON c.id = pr.class_id
LEFT JOIN public.schools sc ON sc.id = c.school_id
WHERE lower(pr.username) IN ('rafaela','laura','lisa','anna','lena')
ORDER BY pr.username;

-- 3. auth.users
SELECT
  'auth.users' AS source,
  id::text,
  email,
  raw_user_meta_data->>'username' AS username,
  created_at::text
FROM auth.users
WHERE lower(raw_user_meta_data->>'username') IN ('rafaela','laura','lisa','anna','lena')
   OR lower(raw_user_meta_data->>'first_name') IN ('rafaela','laura','lisa','anna','lena')
   OR lower(email) LIKE ANY(ARRAY['%rafaela%','%laura%','%lisa%','%anna%','%lena%'])
ORDER BY email;

-- 4. combined_view (was teacher_get_students_auth zurückgibt)
SELECT
  'combined_view' AS source,
  merged.student_id::text,
  merged.auth_user_id::text,
  merged.display_name,
  merged.class_name,
  merged.school_name,
  merged.is_profile_student::text,
  merged.points::text
FROM (
  SELECT
    s.id                              AS student_id,
    s.auth_user_id,
    s.display_name,
    false                             AS is_profile_student,
    COALESCE(p.points, s.points, 0)   AS points,
    c.name                            AS class_name,
    sc.name                           AS school_name
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.auth_user_id
  LEFT JOIN public.classes c  ON c.id = s.class_id
  LEFT JOIN public.schools sc ON sc.id = c.school_id
  WHERE s.deactivated_at IS NULL

  UNION ALL

  SELECT
    pr.id                             AS student_id,
    pr.id                             AS auth_user_id,
    pr.username                       AS display_name,
    true                              AS is_profile_student,
    COALESCE(pr.points, 0)            AS points,
    c.name                            AS class_name,
    sc.name                           AS school_name
  FROM public.profiles pr
  LEFT JOIN public.classes c  ON c.id = pr.class_id
  LEFT JOIN public.schools sc ON sc.id = c.school_id
  WHERE pr.role = 'student'
    AND NOT EXISTS (
      SELECT 1 FROM public.students s2
      WHERE s2.auth_user_id = pr.id
        AND s2.deactivated_at IS NULL
    )
) merged
WHERE lower(merged.display_name) IN ('rafaela','laura','lisa','anna','lena')
ORDER BY merged.display_name;
