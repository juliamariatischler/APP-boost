-- SECURITY DEFINER RPC for supabase-auth teachers to read students' daily_results.
-- Direct RLS-based access is fragile for teacher sessions; this mirrors the pattern
-- used by teacher_get_students_auth / teacher_get_classes_auth.

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
        SELECT COALESCE(s.auth_user_id, s.id)
        FROM public.students s
        WHERE s.class_id = p_class_id
          AND s.deactivated_at IS NULL
      )
        AND dr.date >= p_date_start
        AND dr.date <= p_date_end
    ) r
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_class_daily_results_auth(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_class_daily_results_auth(uuid, date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
