-- ============================================================
-- VOLLSTÄNDIGE PRÜFUNG: Ist 1C überall korrekt der Lehrerin zugeordnet?
-- ============================================================

-- 1. teacher_class_assignments: Hat die Lehrerin Zugriff auf 1C UND 1D?
SELECT
  c.name    AS klasse,
  s.name    AS schule,
  u.email   AS lehrer_email,
  tca.created_at
FROM public.teacher_class_assignments tca
JOIN public.classes c ON c.id = tca.class_id
JOIN public.schools s ON s.id = tca.school_id
JOIN auth.users     u ON u.id = tca.teacher_id
WHERE s.id = '457d7d87-2abc-413c-8d3f-16281085a5bb'
ORDER BY c.name;

-- 2. teacher_student_assignments: Wie viele Schüler pro Klasse zugeordnet?
SELECT
  c.name              AS klasse,
  tsa.approval_status,
  count(*)            AS anzahl_schueler
FROM public.teacher_student_assignments tsa
JOIN public.classes c ON c.id = tsa.class_id
WHERE tsa.teacher_id = '2917a115-f33e-4687-983c-9a2b774f291f'
GROUP BY c.name, tsa.approval_status
ORDER BY c.name;

-- 3. Gibt es 1C-Schüler OHNE teacher_student_assignment? (sollte 0 Zeilen sein)
SELECT p.username, p.class, p.school
FROM public.profiles p
WHERE p.class_id = 'c598324e-2905-4b47-b8ee-ffa8cf44e94a'
  AND p.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM public.teacher_student_assignments tsa
    WHERE tsa.student_id = p.id
      AND tsa.teacher_id = '2917a115-f33e-4687-983c-9a2b774f291f'
  );

-- 4. Gibt es 1D-Schüler OHNE teacher_student_assignment? (sollte 0 Zeilen sein)
SELECT p.username, p.class, p.school
FROM public.profiles p
JOIN public.classes c ON c.id = p.class_id
WHERE c.name = '1D'
  AND c.school_id = '457d7d87-2abc-413c-8d3f-16281085a5bb'
  AND p.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM public.teacher_student_assignments tsa
    WHERE tsa.student_id = p.id
      AND tsa.teacher_id = '2917a115-f33e-4687-983c-9a2b774f291f'
  );

-- 5. Vollbild: alle Pestalozzi-Schüler mit Lehrerzuordnung (wie das Original-CSV)
SELECT
  p.username         AS schueler_name,
  p.class            AS klasse,
  p.school           AS schule,
  tsa.approval_status,
  lp.username        AS lehrer_name,
  u.email            AS lehrer_email
FROM public.profiles p
LEFT JOIN public.teacher_student_assignments tsa
  ON tsa.student_id = p.id
LEFT JOIN public.profiles lp
  ON lp.id = tsa.teacher_id
LEFT JOIN auth.users u
  ON u.id = tsa.teacher_id
WHERE lower(p.school) LIKE '%pestalozzi%'
  AND p.role = 'student'
ORDER BY p.class, p.username;
