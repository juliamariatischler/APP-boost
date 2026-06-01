-- Uppercase any class names that were not merged in the previous migration
-- (those without an existing uppercase counterpart).

DO $$
DECLARE
  r          RECORD;
  v_keep_id  uuid;
  v_new_name text;
BEGIN
  FOR r IN
    SELECT id, name, school_id
    FROM public.classes
    WHERE name != upper(replace(trim(name), ' ', ''))
  LOOP
    v_new_name := upper(replace(trim(r.name), ' ', ''));

    -- Check if an uppercase version already exists (should have been merged, but safety check)
    SELECT id INTO v_keep_id
    FROM public.classes
    WHERE school_id = r.school_id AND name = v_new_name AND id != r.id
    LIMIT 1;

    IF v_keep_id IS NOT NULL THEN
      -- Merge: re-point everything to the existing uppercase class
      RAISE NOTICE 'Merging "%" (%) -> "%" (%)', r.name, r.id, v_new_name, v_keep_id;

      UPDATE public.profiles
      SET class_id = v_keep_id, class = v_new_name
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
      -- No uppercase counterpart exists: simply rename
      RAISE NOTICE 'Renaming "%" -> "%"', r.name, v_new_name;

      UPDATE public.classes SET name = v_new_name WHERE id = r.id;

      UPDATE public.profiles
      SET class = v_new_name
      WHERE class_id = r.id;
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
