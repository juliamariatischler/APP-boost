-- ============================================================
-- School + Class based registration & teacher approval flow
-- ============================================================
-- Adds:
--   profiles.school_id / class_id (FK to schools/classes)
--   teacher_class_assignments   (Supabase-auth teacher → class)
--   teacher_student_assignments.approval_status / school_id / class_id
--   Unique index on classes(school_id, name)
--   RPCs for the new flows
--   Updated handle_new_user trigger

-- ── 1. Add school_id / class_id to profiles ──────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS class_id  uuid REFERENCES public.classes(id);

CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_class_id  ON public.profiles(class_id);


-- ── 2. teacher_class_assignments ─────────────────────────────
-- Maps Supabase-auth teachers to the classes they oversee.

CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id   uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (teacher_id, class_id)
);

ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tca_teacher_select"
  ON public.teacher_class_assignments FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "tca_teacher_insert"
  ON public.teacher_class_assignments FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tca_teacher_delete"
  ON public.teacher_class_assignments FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_tca_teacher_id ON public.teacher_class_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tca_class_id   ON public.teacher_class_assignments(class_id);


-- ── 3. Extend teacher_student_assignments ────────────────────
-- Existing rows keep approval_status = 'accepted' (no workflow change).

ALTER TABLE public.teacher_student_assignments
  ADD COLUMN IF NOT EXISTS approval_status text
    DEFAULT 'accepted'
    CHECK (approval_status IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id),
  ADD COLUMN IF NOT EXISTS class_id  uuid REFERENCES public.classes(id);

CREATE INDEX IF NOT EXISTS idx_tsa_approval
  ON public.teacher_student_assignments(approval_status)
  WHERE approval_status = 'pending';


-- ── 4. Unique class name per school ──────────────────────────
-- Prevents duplicate class names within one school.

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_school_id_name
  ON public.classes (school_id, name);


-- ── 5. RPC: get_schools_list ──────────────────────────────────
-- Public: all active schools with their UUIDs.

CREATE OR REPLACE FUNCTION public.get_schools_list()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name
  FROM   public.schools
  WHERE  active = true
  ORDER  BY name;
$$;

GRANT EXECUTE ON FUNCTION public.get_schools_list() TO anon;
GRANT EXECUTE ON FUNCTION public.get_schools_list() TO authenticated;


-- ── 6. RPC: get_classes_for_school ───────────────────────────
-- Public: active classes for a given school, ordered by name.

CREATE OR REPLACE FUNCTION public.get_classes_for_school(p_school_id uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name
  FROM   public.classes
  WHERE  school_id = p_school_id
    AND  active = true
  ORDER  BY name;
$$;

GRANT EXECUTE ON FUNCTION public.get_classes_for_school(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_classes_for_school(uuid) TO authenticated;


-- ── 7. RPC: add_class_to_school ───────────────────────────────
-- Creates a class if it doesn't exist yet (idempotent).
-- Returns the class id + name.

CREATE OR REPLACE FUNCTION public.add_class_to_school(
  p_school_id  uuid,
  p_class_name text
)
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id   uuid;
  v_name text := trim(p_class_name);
BEGIN
  IF length(v_name) < 1 THEN
    RAISE EXCEPTION 'Klassenname darf nicht leer sein';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.schools sch WHERE sch.id = p_school_id AND sch.active = true) THEN
    RAISE EXCEPTION 'Schule nicht gefunden';
  END IF;

  -- Insert; ignore conflict (same name already exists for this school)
  INSERT INTO public.classes (school_id, name, active)
  VALUES (p_school_id, v_name, true)
  ON CONFLICT DO NOTHING;

  SELECT c.id INTO v_id
  FROM   public.classes c
  WHERE  c.school_id = p_school_id AND c.name = v_name;

  RETURN QUERY SELECT v_id, v_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_class_to_school(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_class_to_school(uuid, text) TO authenticated;


-- ── 8. RPC: get_teacher_class_assignments_auth ────────────────
-- Returns the teacher's explicitly assigned classes.

CREATE OR REPLACE FUNCTION public.get_teacher_class_assignments_auth()
RETURNS TABLE (
  id          uuid,
  school_id   uuid,
  school_name text,
  class_id    uuid,
  class_name  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT tca.id, tca.school_id, s.name, tca.class_id, c.name
  FROM   public.teacher_class_assignments tca
  JOIN   public.schools s ON s.id = tca.school_id
  JOIN   public.classes c ON c.id = tca.class_id
  WHERE  tca.teacher_id = auth.uid()
  ORDER  BY s.name, c.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_teacher_class_assignments_auth() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_teacher_class_assignments_auth() TO authenticated;


-- ── 9. RPC: save_teacher_class_assignment_auth ────────────────
-- Teacher claims a class. Auto-assigns any existing students with matching
-- school_id + class_id as pending requests.

CREATE OR REPLACE FUNCTION public.save_teacher_class_assignment_auth(
  p_school_id uuid,
  p_class_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin-Rolle erforderlich';
  END IF;

  -- Verify class belongs to school
  IF NOT EXISTS (
    SELECT 1 FROM public.classes WHERE id = p_class_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Klasse gehört nicht zu dieser Schule';
  END IF;

  INSERT INTO public.teacher_class_assignments (teacher_id, school_id, class_id)
  VALUES (auth.uid(), p_school_id, p_class_id)
  ON CONFLICT (teacher_id, class_id) DO NOTHING;

  -- Auto-create pending assignments for already-registered students in this class
  INSERT INTO public.teacher_student_assignments
    (teacher_id, student_id, approval_status, school_id, class_id)
  SELECT
    auth.uid(), p.id, 'pending', p_school_id, p_class_id
  FROM public.profiles p
  WHERE p.class_id  = p_class_id
    AND p.school_id = p_school_id
    AND p.role      = 'student'
  ON CONFLICT (teacher_id, student_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_teacher_class_assignment_auth(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.save_teacher_class_assignment_auth(uuid, uuid) TO authenticated;


-- ── 10. RPC: remove_teacher_class_assignment_auth ─────────────

CREATE OR REPLACE FUNCTION public.remove_teacher_class_assignment_auth(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.teacher_class_assignments
  WHERE teacher_id = auth.uid() AND class_id = p_class_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_teacher_class_assignment_auth(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.remove_teacher_class_assignment_auth(uuid) TO authenticated;


-- ── 11. RPC: get_pending_students_for_teacher_auth ────────────
-- Returns students with approval_status = 'pending' for the teacher's classes.

CREATE OR REPLACE FUNCTION public.get_pending_students_for_teacher_auth()
RETURNS TABLE (
  assignment_id uuid,
  student_id    uuid,
  username      text,
  school_name   text,
  class_name    text,
  created_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    tsa.id,
    tsa.student_id,
    p.username,
    COALESCE(s.name, p.school),
    COALESCE(c.name, p.class),
    tsa.created_at
  FROM   public.teacher_student_assignments tsa
  JOIN   public.profiles p ON p.id = tsa.student_id
  LEFT   JOIN public.schools s ON s.id = tsa.school_id
  LEFT   JOIN public.classes c ON c.id = tsa.class_id
  WHERE  tsa.teacher_id     = auth.uid()
    AND  tsa.approval_status = 'pending'
  ORDER  BY tsa.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pending_students_for_teacher_auth() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_pending_students_for_teacher_auth() TO authenticated;


-- ── 12. RPC: update_student_approval_auth ─────────────────────

CREATE OR REPLACE FUNCTION public.update_student_approval_auth(
  p_student_id uuid,
  p_status     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Ungültiger Status';
  END IF;

  UPDATE public.teacher_student_assignments
  SET    approval_status = p_status
  WHERE  teacher_id = auth.uid()
    AND  student_id = p_student_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_student_approval_auth(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_student_approval_auth(uuid, text) TO authenticated;


-- ── 13. Update handle_new_user trigger ───────────────────────
-- Adds school_id / class_id handling and auto-creates pending teacher
-- assignment when a student self-registers with a known class.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type text;
  v_profile_class  text;
  v_profile_school text;
  v_profile_age    integer;
  v_school_id      uuid;
  v_class_id       uuid;
  v_base_username  text;
  v_username       text;
  v_attempt        integer := 0;
  v_constraint     text;
  v_teacher_id     uuid;
BEGIN
  v_account_type := COALESCE(NULLIF(lower(new.raw_user_meta_data->>'account_type'), ''), 'student');
  IF v_account_type NOT IN ('student', 'teacher') THEN
    v_account_type := 'student';
  END IF;

  v_profile_class  := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'class'),  ''), 'unbekannt');
  v_profile_school := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'school'), ''), 'unbekannt');

  BEGIN
    v_profile_age := NULLIF(trim(new.raw_user_meta_data->>'age'), '')::integer;
  EXCEPTION WHEN OTHERS THEN
    v_profile_age := NULL;
  END;

  IF v_account_type = 'teacher' AND v_profile_class = 'unbekannt' THEN
    v_profile_class := 'Lehrkraft';
    v_profile_age   := NULL;
  END IF;

  -- Parse UUIDs from metadata (gracefully ignore invalid values)
  BEGIN
    v_school_id := (new.raw_user_meta_data->>'school_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_school_id := NULL;
  END;

  BEGIN
    v_class_id := (new.raw_user_meta_data->>'class_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_class_id := NULL;
  END;

  -- If IDs were provided but text names weren't, look them up
  IF v_school_id IS NOT NULL AND v_profile_school = 'unbekannt' THEN
    SELECT name INTO v_profile_school FROM public.schools WHERE id = v_school_id;
    v_profile_school := COALESCE(v_profile_school, 'unbekannt');
  END IF;

  IF v_class_id IS NOT NULL AND v_profile_class = 'unbekannt' THEN
    SELECT name INTO v_profile_class FROM public.classes WHERE id = v_class_id;
    v_profile_class := COALESCE(v_profile_class, 'unbekannt');
    IF v_account_type = 'teacher' THEN
      v_profile_class := 'Lehrkraft';
    END IF;
  END IF;

  v_base_username := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'username'), ''),
    NULLIF(split_part(new.email, '@', 1), ''),
    'user'
  );

  v_username := lower(regexp_replace(v_base_username, '[^a-zA-Z0-9_\-]', '', 'g'));
  v_username := COALESCE(NULLIF(v_username, ''), 'user');
  v_username := left(v_username, 40);

  LOOP
    BEGIN
      INSERT INTO public.profiles (id, username, school, class, age, role, school_id, class_id)
      VALUES (
        new.id, v_username, v_profile_school, v_profile_class,
        v_profile_age, v_account_type, v_school_id, v_class_id
      );
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;

        IF v_constraint IS DISTINCT FROM 'profiles_username_key' THEN
          RAISE;
        END IF;

        v_attempt := v_attempt + 1;
        IF v_attempt > 25 THEN
          RAISE EXCEPTION 'Could not generate unique username after % attempts', v_attempt;
        END IF;

        v_username := left(v_username, 30) || '_' || substr(md5(new.id::text || v_attempt::text), 1, 8);
      WHEN OTHERS THEN
        RAISE;
    END;
  END LOOP;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_account_type = 'teacher' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Auto-create pending assignment when a student registers for a class with a teacher
  IF v_account_type = 'student' AND v_class_id IS NOT NULL THEN
    BEGIN
      SELECT teacher_id INTO v_teacher_id
      FROM   public.teacher_class_assignments
      WHERE  class_id = v_class_id
      LIMIT  1;

      IF v_teacher_id IS NOT NULL THEN
        INSERT INTO public.teacher_student_assignments
          (teacher_id, student_id, approval_status, school_id, class_id)
        VALUES
          (v_teacher_id, new.id, 'pending', v_school_id, v_class_id)
        ON CONFLICT (teacher_id, student_id) DO NOTHING;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Never fail the whole registration because of the auto-assignment step
    END;
  END IF;

  RETURN new;
END;
$$;
