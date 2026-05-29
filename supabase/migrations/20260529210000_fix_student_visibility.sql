-- ============================================================
-- Fix: newly registered students invisible in Übersicht / Wertung
-- ============================================================
--
-- Two root causes:
--
--   1. teacher_can_access_class used only school-name matching.
--      After migration 20260529130000 teachers are stored in
--      teacher_class_assignments (UUID-based). If the school-name
--      stored in profiles.school differs even slightly from the
--      actual school name, teacher_get_students_auth returned an
--      access-denied error and loadStudents() fell into its catch
--      branch → students = [] in TeacherHome.
--
--   2. get_class_daily_results_auth / get_class_student_daily_results
--      only looked for user IDs in the students table.  Students who
--      registered via the normal signup flow exist only in profiles
--      (they have no students row until QR activation), so their
--      daily_results were never fetched.
--
-- Fixes:
--   1. teacher_can_access_class → check teacher_class_assignments
--      FIRST (the definitive, UUID-based source of truth) and fall
--      back to school-name matching for legacy classes that predate
--      the assignments table.
--
--   2. get_class_daily_results_auth / get_class_student_daily_results
--      → UNION in profile-only students so their activity shows in
--      the weekly overview.
-- ============================================================


-- ── 1. teacher_can_access_class ───────────────────────────────

CREATE OR REPLACE FUNCTION public.teacher_can_access_class(p_class_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile     public.profiles%ROWTYPE;
  v_school_name text;
BEGIN
  IF NOT public.is_current_teacher() THEN
    RETURN false;
  END IF;

  -- Primary check: explicit class assignment (UUID-based, always authoritative).
  IF EXISTS (
    SELECT 1 FROM public.teacher_class_assignments
    WHERE class_id   = p_class_id
      AND teacher_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- Fallback: school-name matching for classes that pre-date the
  -- assignments table or were not created through the standard flow.
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT s.name INTO v_school_name
  FROM public.classes c
  JOIN public.schools s ON s.id = c.school_id
  WHERE c.id = p_class_id;

  RETURN v_school_name IS NOT NULL
    AND lower(v_school_name) = lower(
          COALESCE(NULLIF(v_profile.school, ''), v_school_name)
        );
END;
$$;


-- ── 2. get_class_daily_results_auth (supabase-auth teacher) ───

CREATE OR REPLACE FUNCTION public.get_class_daily_results_auth(
  p_class_id   uuid,
  p_date_start date,
  p_date_end   date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_teacher() THEN
    RETURN jsonb_build_object('error', 'Unauthorized: teacher role required');
  END IF;

  IF NOT public.teacher_can_access_class(p_class_id) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
    FROM (
      SELECT
        dr.user_id,
        dr.date::text,
        dr.jumping_jacks,
        dr.push_ups,
        dr.squats,
        dr.planks,
        dr.sit_ups,
        dr.steps,
        dr.steps_tracking_active
      FROM public.daily_results dr
      WHERE dr.user_id IN (
        -- QR-managed students (progress tracked under auth_user_id once activated,
        -- or under students.id before activation)
        SELECT COALESCE(s.auth_user_id, s.id)
        FROM public.students s
        WHERE s.class_id       = p_class_id
          AND s.deactivated_at IS NULL

        UNION

        -- Self-registered profile students not in the students table
        SELECT pr.id
        FROM public.profiles pr
        WHERE pr.class_id = p_class_id
          AND pr.role     = 'student'
          AND NOT EXISTS (
                SELECT 1 FROM public.students s2
                WHERE s2.auth_user_id  = pr.id
                  AND s2.class_id      = p_class_id
                  AND s2.deactivated_at IS NULL
              )
      )
        AND dr.date >= p_date_start
        AND dr.date <= p_date_end
    ) r
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_class_daily_results_auth(uuid, date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_class_daily_results_auth(uuid, date, date) TO authenticated;


-- ── 3. get_class_student_daily_results (code-auth teacher) ────

CREATE OR REPLACE FUNCTION public.get_class_student_daily_results(
  p_device_id     text,
  p_session_token text,
  p_class_id      uuid,
  p_date_start    date,
  p_date_end      date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  SELECT user_id INTO v_teacher_id
  FROM public.active_sessions
  WHERE device_id          = p_device_id
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active             = true
    AND user_type          = 'teacher'
    AND expires_at         > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Keine aktive Lehrer-Session');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_class_access
    WHERE teacher_id = v_teacher_id AND class_id = p_class_id
  ) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
    FROM (
      SELECT
        dr.user_id,
        dr.date::text,
        dr.jumping_jacks,
        dr.push_ups,
        dr.squats,
        dr.planks,
        dr.sit_ups,
        dr.steps,
        dr.steps_tracking_active
      FROM public.daily_results dr
      WHERE dr.user_id IN (
        SELECT COALESCE(s.auth_user_id, s.id)
        FROM public.students s
        WHERE s.class_id       = p_class_id
          AND s.deactivated_at IS NULL

        UNION

        SELECT pr.id
        FROM public.profiles pr
        WHERE pr.class_id = p_class_id
          AND pr.role     = 'student'
          AND NOT EXISTS (
                SELECT 1 FROM public.students s2
                WHERE s2.auth_user_id  = pr.id
                  AND s2.class_id      = p_class_id
                  AND s2.deactivated_at IS NULL
              )
      )
        AND dr.date >= p_date_start
        AND dr.date <= p_date_end
    ) r
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_class_student_daily_results(text, text, uuid, date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_class_student_daily_results(text, text, uuid, date, date) TO anon, authenticated;


NOTIFY pgrst, 'reload schema';
