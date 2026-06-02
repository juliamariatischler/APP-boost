-- Alle Pestalozzi-Schüler mit ihrer Lehrerin – schwarz auf weiß
SELECT
  p.username                          AS schueler_name,
  p.class                             AS klasse,
  lp.username                         AS lehrer_name,
  lu.email                            AS lehrer_email,
  tsa.approval_status
FROM public.profiles p
JOIN public.teacher_student_assignments tsa ON tsa.student_id = p.id
JOIN public.profiles lp                     ON lp.id = tsa.teacher_id
JOIN auth.users lu                          ON lu.id = tsa.teacher_id
WHERE lower(p.school) LIKE '%pestalozzi%'
  AND p.role = 'student'
ORDER BY p.class, p.username;
