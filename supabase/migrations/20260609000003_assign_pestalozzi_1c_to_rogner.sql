-- Assign teacher Michaela Rogner (roschine / michaela.rogner@pestalozzi.at)
-- to classes 1C and 1D at BG/BRG Pestalozzi.
--
-- Makes the assignment consistent in every layer of the system:
--   1. teacher_class_assignments  – grants access to both classes
--   2. profiles.school_id/class_id – back-fills UUID FKs for any students
--      still carrying only legacy free-text fields
--   3. teacher_student_assignments – accepted rows for every student in
--      both classes (excludes the teacher's own profile)

DO $$
DECLARE
  v_school_id   uuid;
  v_class_1c_id uuid;
  v_class_1d_id uuid;
  v_teacher_id  uuid;
BEGIN
  -- ── 1. Resolve school ──────────────────────────────────────────
  SELECT id INTO v_school_id
  FROM public.schools
  WHERE name = 'BG/BRG Pestalozzi' AND active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_school_id IS NULL THEN
    INSERT INTO public.schools (name, active)
    VALUES ('BG/BRG Pestalozzi', true)
    RETURNING id INTO v_school_id;
  END IF;

  -- ── 2. Ensure classes 1C and 1D exist ─────────────────────────
  INSERT INTO public.classes (school_id, name, active)
  VALUES (v_school_id, '1C', true), (v_school_id, '1D', true)
  ON CONFLICT (school_id, name) DO NOTHING;

  SELECT id INTO v_class_1c_id FROM public.classes
  WHERE school_id = v_school_id AND name = '1C';

  SELECT id INTO v_class_1d_id FROM public.classes
  WHERE school_id = v_school_id AND name = '1D';

  -- ── 3. Resolve teacher ────────────────────────────────────────
  SELECT id INTO v_teacher_id
  FROM auth.users
  WHERE lower(email) = 'michaela.rogner@pestalozzi.at'
  LIMIT 1;

  IF v_teacher_id IS NULL THEN
    RAISE NOTICE 'Teacher michaela.rogner@pestalozzi.at not found — skipping';
    RETURN;
  END IF;

  -- ── 4. Assign teacher to both classes ─────────────────────────
  INSERT INTO public.teacher_class_assignments (teacher_id, school_id, class_id)
  VALUES
    (v_teacher_id, v_school_id, v_class_1c_id),
    (v_teacher_id, v_school_id, v_class_1d_id)
  ON CONFLICT (teacher_id, class_id) DO NOTHING;

  -- ── 5. Back-fill school_id / class_id on student profiles ─────
  UPDATE public.profiles
  SET school_id = v_school_id,
      class_id  = v_class_1c_id
  WHERE role = 'student'
    AND lower(school) = lower('BG/BRG Pestalozzi')
    AND upper(replace(trim(class), ' ', '')) = '1C'
    AND (school_id IS NULL OR class_id IS NULL);

  UPDATE public.profiles
  SET school_id = v_school_id,
      class_id  = v_class_1d_id
  WHERE role = 'student'
    AND lower(school) = lower('BG/BRG Pestalozzi')
    AND upper(replace(trim(class), ' ', '')) = '1D'
    AND (school_id IS NULL OR class_id IS NULL);

  -- ── 6. Upsert teacher_student_assignments for all students ─────
  -- Excludes the teacher's own profile (she is not her own student).
  INSERT INTO public.teacher_student_assignments
    (teacher_id, student_id, approval_status, school_id, class_id)
  SELECT
    v_teacher_id,
    p.id,
    'accepted',
    v_school_id,
    c.id
  FROM public.profiles p
  JOIN public.classes c ON c.id = p.class_id
  WHERE c.school_id = v_school_id
    AND c.name IN ('1C', '1D')
    AND p.role = 'student'
    AND p.id  != v_teacher_id
  ON CONFLICT (teacher_id, student_id) DO UPDATE
    SET approval_status = 'accepted',
        school_id       = EXCLUDED.school_id,
        class_id        = EXCLUDED.class_id;

  RAISE NOTICE 'Done: 1C + 1D at BG/BRG Pestalozzi fully assigned to teacher %', v_teacher_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
