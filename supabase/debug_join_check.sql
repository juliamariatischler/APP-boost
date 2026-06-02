-- Prüft ob der JOIN-Pfad für 1C funktioniert
-- (warum zeigt die gespeicherte Abfrage noch NULL?)

-- A: Existieren die tsa-Zeilen für 1C? Stimmt der teacher_id?
SELECT
  tsa.student_id,
  tsa.teacher_id,
  tsa.approval_status,
  lp.id           AS teacher_profile_id,
  lp.username     AS teacher_username,
  lu.email        AS teacher_email
FROM public.teacher_student_assignments tsa
LEFT JOIN public.profiles lp ON lp.id = tsa.teacher_id
LEFT JOIN auth.users      lu ON lu.id = tsa.teacher_id
WHERE tsa.class_id  = 'c598324e-2905-4b47-b8ee-ffa8cf44e94a'
LIMIT 5;

-- B: Matcht student_id mit einem echten Profile-Eintrag eines 1C-Schülers?
SELECT
  p.username,
  p.class,
  tsa.teacher_id,
  tsa.approval_status
FROM public.profiles p
JOIN public.teacher_student_assignments tsa ON tsa.student_id = p.id
WHERE p.class_id = 'c598324e-2905-4b47-b8ee-ffa8cf44e94a'
  AND p.role = 'student'
LIMIT 5;
