-- Fügt teacher_student_assignments für ALLE Schüler beider Klassen ein,
-- die noch fehlen. Nutzt bekannte UUIDs für school + teacher.

INSERT INTO public.teacher_student_assignments
  (teacher_id, student_id, approval_status, school_id, class_id)
SELECT
  '2917a115-f33e-4687-983c-9a2b774f291f' AS teacher_id,
  p.id                                    AS student_id,
  'accepted'                              AS approval_status,
  '457d7d87-2abc-413c-8d3f-16281085a5bb' AS school_id,
  c.id                                    AS class_id
FROM public.profiles p
JOIN public.classes c ON c.id = p.class_id
WHERE c.school_id = '457d7d87-2abc-413c-8d3f-16281085a5bb'
  AND c.name IN ('1C', '1D')
  AND p.role = 'student'
  AND p.id != '2917a115-f33e-4687-983c-9a2b774f291f'
ON CONFLICT (teacher_id, student_id) DO UPDATE
  SET approval_status = 'accepted',
      school_id       = EXCLUDED.school_id,
      class_id        = EXCLUDED.class_id;

-- Ergebnis prüfen
SELECT
  c.name              AS klasse,
  tsa.approval_status,
  count(*)            AS anzahl
FROM public.teacher_student_assignments tsa
JOIN public.classes c ON c.id = tsa.class_id
WHERE tsa.teacher_id = '2917a115-f33e-4687-983c-9a2b774f291f'
  AND c.school_id    = '457d7d87-2abc-413c-8d3f-16281085a5bb'
GROUP BY c.name, tsa.approval_status
ORDER BY c.name;
