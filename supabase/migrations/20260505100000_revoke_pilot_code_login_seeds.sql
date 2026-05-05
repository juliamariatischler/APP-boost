-- Revoke previously seeded pilot code-login rows and invalidate their sessions.
-- This does not touch the normal email/password demo accounts:
-- demo@boost-challenge.de and demo-lehrkraft@boost-challenge.de.

DO $$
DECLARE
  v_teacher_ids uuid[];
  v_student_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(t.id), ARRAY[]::uuid[])
  INTO v_teacher_ids
  FROM public.teachers t
  WHERE t.full_name IN (
    'Mag. Anna Berger',
    'Mag. Lukas Steiner',
    'Mag. Eva Fuchs'
  );

  SELECT COALESCE(array_agg(st.id), ARRAY[]::uuid[])
  INTO v_student_ids
  FROM public.students st
  JOIN public.classes c ON c.id = st.class_id
  JOIN public.schools s ON s.id = c.school_id
  WHERE s.name = 'Ursulinen Graz'
    AND c.name IN ('3a', '3b', '3c');

  UPDATE public.active_sessions
  SET active = false,
      last_seen_at = now()
  WHERE (user_type = 'teacher' AND user_id = ANY(v_teacher_ids))
     OR (user_type = 'student' AND user_id = ANY(v_student_ids));

  UPDATE public.teachers
  SET active = false,
      login_code = 'REVOKED-' || id::text
  WHERE id = ANY(v_teacher_ids);

  UPDATE public.students
  SET active = false,
      login_code = 'REVOKED-' || id::text
  WHERE id = ANY(v_student_ids);
END $$;
