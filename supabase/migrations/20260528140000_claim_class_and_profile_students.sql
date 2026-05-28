-- ============================================================
-- Exclusive class claiming + profile students in teacher views
-- ============================================================
-- Changes:
--   1. get_classes_for_school   – exclude classes claimed by another teacher
--   2. save_teacher_class_assignment_auth – exclusive claim (one teacher per class)
--   3. teacher_get_classes_auth – hide other-teacher classes; count includes profile students
--   4. teacher_get_students_auth – UNION with self-registered profile students


-- ── 1. get_classes_for_school ────────────────────────────────
-- Exclude classes already claimed by a DIFFERENT teacher so the
-- dropdown only shows claimable (or already-mine) classes.

CREATE OR REPLACE FUNCTION public.get_classes_for_school(p_school_id uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name
  FROM   public.classes c
  WHERE  c.school_id = p_school_id
    AND  c.active = true
    AND  NOT EXISTS (
           SELECT 1
           FROM   public.teacher_class_assignments tca
           WHERE  tca.class_id   = c.id
             AND  tca.teacher_id != COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
         )
  ORDER  BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_classes_for_school(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_classes_for_school(uuid) TO authenticated;


-- ── 2. save_teacher_class_assignment_auth ────────────────────
-- A class can only be claimed by ONE teacher. Raise an error if
-- another teacher has already claimed it.

CREATE OR REPLACE FUNCTION public.save_teacher_class_assignment_auth(
  p_school_id uuid,
  p_class_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_teacher uuid;
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

  -- Exclusive: check if already claimed by a different teacher
  SELECT teacher_id INTO v_other_teacher
  FROM   public.teacher_class_assignments
  WHERE  class_id   = p_class_id
    AND  teacher_id != auth.uid()
  LIMIT  1;

  IF v_other_teacher IS NOT NULL THEN
    RAISE EXCEPTION 'Diese Klasse wurde bereits von einer anderen Lehrkraft übernommen';
  END IF;

  INSERT INTO public.teacher_class_assignments (teacher_id, school_id, class_id)
  VALUES (auth.uid(), p_school_id, p_class_id)
  ON CONFLICT (teacher_id, class_id) DO NOTHING;

  -- Auto-create pending assignments for already-registered profile students
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


-- ── 3. teacher_get_classes_auth ──────────────────────────────
-- Show only classes that are NOT claimed by another teacher.
-- student_count now includes profile-based students.

CREATE OR REPLACE FUNCTION public.teacher_get_classes_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_result  jsonb;
BEGIN
  PERFORM public.ensure_teacher_default_class();

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT jsonb_agg(
    jsonb_build_object(
      'class_id',     c.id,
      'class_name',   c.name,
      'school_name',  s.name,
      'student_count', (
        SELECT count(*) FROM (
          -- QR-code students
          SELECT st.id
          FROM   public.students st
          WHERE  st.class_id        = c.id
            AND  COALESCE(st.active, true) = true
            AND  st.deactivated_at IS NULL
          UNION
          -- Self-registered profile students not yet in students table
          SELECT pr.id
          FROM   public.profiles pr
          WHERE  pr.class_id = c.id
            AND  pr.role     = 'student'
            AND  NOT EXISTS (
                   SELECT 1 FROM public.students s2
                   WHERE  s2.auth_user_id  = pr.id
                     AND  s2.class_id      = c.id
                     AND  s2.deactivated_at IS NULL
                 )
        ) combined
      )
    )
    ORDER BY c.name
  ) INTO v_result
  FROM public.classes c
  JOIN public.schools s ON s.id = c.school_id
  WHERE c.active = true
    AND lower(s.name) = lower(COALESCE(NULLIF(v_profile.school, ''), s.name))
    -- Hide classes claimed by a different teacher
    AND NOT EXISTS (
          SELECT 1
          FROM   public.teacher_class_assignments tca
          WHERE  tca.class_id   = c.id
            AND  tca.teacher_id != auth.uid()
        );

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_get_classes_auth() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.teacher_get_classes_auth() TO authenticated;


-- ── 4. teacher_get_students_auth ─────────────────────────────
-- Returns QR-code students (students table) UNION profile-based
-- students who registered themselves into this class.
-- Adds is_profile_student field so the UI can render them differently.

CREATE OR REPLACE FUNCTION public.teacher_get_students_auth(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_current_teacher() THEN
    RETURN jsonb_build_object('error', 'Unauthorized: teacher role required');
  END IF;

  IF NOT public.teacher_can_access_class(p_class_id) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'student_id',                 merged.student_id,
      'auth_user_id',               merged.auth_user_id,
      'progress_user_id',           merged.progress_user_id,
      'display_name',               merged.display_name,
      'first_name',                 merged.first_name,
      'points',                     merged.points,
      'active',                     merged.active,
      'activated_at',               merged.activated_at,
      'device_id',                  merged.device_id,
      'activation_code_created_at', merged.activation_code_created_at,
      'activation_code_used_at',    merged.activation_code_used_at,
      'is_profile_student',         merged.is_profile_student
    )
    ORDER BY merged.display_name
  ) INTO v_result
  FROM (
    -- QR-code managed students
    SELECT
      s.id                                     AS student_id,
      s.auth_user_id,
      COALESCE(s.auth_user_id, s.id)           AS progress_user_id,
      s.display_name,
      s.first_name,
      COALESCE(p.points, s.points, 0)::int     AS points,
      s.active,
      s.activated_at,
      s.device_id,
      s.activation_code_created_at,
      s.activation_code_used_at,
      false                                    AS is_profile_student
    FROM public.students s
    LEFT JOIN public.profiles p ON p.id = s.auth_user_id
    WHERE s.class_id       = p_class_id
      AND s.deactivated_at IS NULL

    UNION ALL

    -- Self-registered profile students not already in students table
    SELECT
      pr.id                                    AS student_id,
      pr.id                                    AS auth_user_id,
      pr.id                                    AS progress_user_id,
      pr.username                              AS display_name,
      pr.username                              AS first_name,
      COALESCE(pr.points, 0)::int              AS points,
      true                                     AS active,
      pr.created_at                            AS activated_at,
      NULL::text                               AS device_id,
      NULL::timestamptz                        AS activation_code_created_at,
      NULL::timestamptz                        AS activation_code_used_at,
      true                                     AS is_profile_student
    FROM public.profiles pr
    WHERE pr.class_id = p_class_id
      AND pr.role     = 'student'
      AND NOT EXISTS (
            SELECT 1 FROM public.students s2
            WHERE  s2.auth_user_id  = pr.id
              AND  s2.class_id      = p_class_id
              AND  s2.deactivated_at IS NULL
          )
  ) merged;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_get_students_auth(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.teacher_get_students_auth(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
