-- Prüft ob teacher_student_assignments für 1C-Schüler vorhanden ist
-- (das ist die Tabelle, die der CSV-Bericht verwendet)

-- A: Wie viele 1C-Schüler haben eine teacher_student_assignment?
SELECT
  tsa.approval_status,
  count(*) AS anzahl
FROM public.teacher_student_assignments tsa
WHERE tsa.class_id = 'c598324e-2905-4b47-b8ee-ffa8cf44e94a'
  AND tsa.teacher_id = '2917a115-f33e-4687-983c-9a2b774f291f'
GROUP BY tsa.approval_status;

-- B: Welche 1C-Schüler fehlen noch in teacher_student_assignments?
SELECT p.username, p.class, p.school
FROM public.profiles p
WHERE p.class_id = 'c598324e-2905-4b47-b8ee-ffa8cf44e94a'
  AND p.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM public.teacher_student_assignments tsa
    WHERE tsa.student_id = p.id
      AND tsa.teacher_id = '2917a115-f33e-4687-983c-9a2b774f291f'
  );

-- C: Fix — fehlende Zeilen direkt einfügen (mit den bekannten UUIDs)
INSERT INTO public.teacher_student_assignments
  (teacher_id, student_id, approval_status, school_id, class_id)
SELECT
  '2917a115-f33e-4687-983c-9a2b774f291f',
  p.id,
  'accepted',
  '457d7d87-2abc-413c-8d3f-16281085a5bb',
  'c598324e-2905-4b47-b8ee-ffa8cf44e94a'
FROM public.profiles p
WHERE p.class_id = 'c598324e-2905-4b47-b8ee-ffa8cf44e94a'
  AND p.role = 'student'
ON CONFLICT (teacher_id, student_id) DO NOTHING;

-- D: Ergebnis prüfen
SELECT count(*) AS eingefuegte_zuordnungen
FROM public.teacher_student_assignments
WHERE class_id  = 'c598324e-2905-4b47-b8ee-ffa8cf44e94a'
  AND teacher_id = '2917a115-f33e-4687-983c-9a2b774f291f';
