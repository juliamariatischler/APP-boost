-- ============================================================
-- Fix: teacher-claimed classes are invisible in student registration
-- ============================================================
-- Root cause (migration 20260528140000):
--   get_classes_for_school added a NOT EXISTS filter to exclude classes
--   claimed by another teacher. But when called by a student (or an
--   anonymous user during signup), auth.uid() is the student's UUID,
--   so every teacher-assigned class is treated as "claimed by someone
--   else" and hidden from the dropdown.
--
-- Solution:
--   1. Revert get_classes_for_school to return ALL active classes for
--      a school — no teacher-exclusion filter.  Students (and anon
--      callers) must be able to see every class.
--   2. Add a new get_claimable_classes_for_school(p_school_id) RPC that
--      DOES apply the teacher-exclusion filter. This is used only in the
--      teacher "Klasse übernehmen" UI where the restriction makes sense.
-- ============================================================


-- ── 1. get_classes_for_school (student-facing) ────────────────
-- Returns ALL active classes for a school.
-- Used by: student registration dropdown.

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
    AND  c.active    = true
  ORDER  BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_classes_for_school(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_classes_for_school(uuid) TO authenticated;


-- ── 2. get_claimable_classes_for_school (teacher-facing) ──────
-- Returns active classes for a school that have NOT been claimed by
-- a different teacher. Used by the teacher "Klasse übernehmen" UI.

CREATE OR REPLACE FUNCTION public.get_claimable_classes_for_school(p_school_id uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name
  FROM   public.classes c
  WHERE  c.school_id = p_school_id
    AND  c.active    = true
    AND  NOT EXISTS (
           SELECT 1
           FROM   public.teacher_class_assignments tca
           WHERE  tca.class_id   = c.id
             AND  tca.teacher_id != COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
         )
  ORDER  BY c.name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_claimable_classes_for_school(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_claimable_classes_for_school(uuid) TO authenticated;
