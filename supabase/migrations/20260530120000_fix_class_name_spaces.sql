-- Fix: remove all spaces from class names and merge resulting duplicates.
-- "4 M" -> "4M", then merge with existing "4M" if present.

DO $$
DECLARE
  r          RECORD;
  v_keep_id  uuid;
  v_clean    text;
BEGIN
  FOR r IN
    SELECT id, name, school_id
    FROM public.classes
    WHERE name != replace(name, ' ', '')
  LOOP
    v_clean := replace(r.name, ' ', '');

    -- Check if a class with the clean name already exists
    SELECT id INTO v_keep_id
    FROM public.classes
    WHERE school_id = r.school_id AND name = v_clean
    LIMIT 1;

    IF v_keep_id IS NOT NULL THEN
      -- Merge: re-point everything to the existing clean class, delete this one
      RAISE NOTICE 'Merging "%" (%) -> "%" (%)', r.name, r.id, v_clean, v_keep_id;

      UPDATE public.profiles
      SET class_id = v_keep_id, class = v_clean
      WHERE class_id = r.id;

      UPDATE public.students
      SET class_id = v_keep_id
      WHERE class_id = r.id;

      UPDATE public.teacher_class_assignments
      SET class_id = v_keep_id
      WHERE class_id = r.id
        AND NOT EXISTS (
          SELECT 1 FROM public.teacher_class_assignments t2
          WHERE t2.class_id = v_keep_id AND t2.teacher_id = teacher_class_assignments.teacher_id
        );
      DELETE FROM public.teacher_class_assignments WHERE class_id = r.id;

      UPDATE public.teacher_student_assignments
      SET class_id = v_keep_id
      WHERE class_id = r.id;

      DELETE FROM public.classes WHERE id = r.id;

    ELSE
      -- No duplicate: just rename in place
      RAISE NOTICE 'Renaming "%" -> "%"', r.name, v_clean;

      UPDATE public.classes SET name = v_clean WHERE id = r.id;

      UPDATE public.profiles
      SET class = v_clean
      WHERE class_id = r.id;
    END IF;

  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
