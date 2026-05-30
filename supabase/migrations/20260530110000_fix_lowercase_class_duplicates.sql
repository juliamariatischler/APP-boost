-- Fix: merge duplicate classes that differ only in case (e.g. "1c" -> "1C").
-- For each lowercase class that has an uppercase counterpart, re-point all
-- profiles/students/assignments to the uppercase one and delete the lowercase entry.

DO $$
DECLARE
  r          RECORD;
  v_keep_id  uuid;
BEGIN
  FOR r IN
    SELECT id AS drop_id, name AS drop_name, school_id, upper(name) AS canonical
    FROM public.classes
    WHERE name != upper(name)
  LOOP
    SELECT id INTO v_keep_id
    FROM public.classes
    WHERE school_id = r.school_id AND name = r.canonical
    LIMIT 1;

    CONTINUE WHEN v_keep_id IS NULL;

    RAISE NOTICE 'Merging "%" (%) -> "%" (%)', r.drop_name, r.drop_id, r.canonical, v_keep_id;

    UPDATE public.profiles
    SET class_id = v_keep_id, class = r.canonical
    WHERE class_id = r.drop_id;

    UPDATE public.students
    SET class_id = v_keep_id
    WHERE class_id = r.drop_id;

    UPDATE public.teacher_class_assignments
    SET class_id = v_keep_id
    WHERE class_id = r.drop_id
      AND NOT EXISTS (
        SELECT 1 FROM public.teacher_class_assignments t2
        WHERE t2.class_id = v_keep_id AND t2.teacher_id = teacher_class_assignments.teacher_id
      );
    DELETE FROM public.teacher_class_assignments WHERE class_id = r.drop_id;

    UPDATE public.teacher_student_assignments
    SET class_id = v_keep_id
    WHERE class_id = r.drop_id;

    DELETE FROM public.classes WHERE id = r.drop_id;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
