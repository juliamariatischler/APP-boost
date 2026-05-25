-- RPC for code-auth teachers to read their students' daily_results.
-- Direct table access fails for code-auth sessions because auth.uid() is NULL
-- (no Supabase session). This SECURITY DEFINER function bypasses RLS.

CREATE OR REPLACE FUNCTION public.get_class_student_daily_results(
  p_device_id   text,
  p_session_token text,
  p_class_id    uuid,
  p_date_start  date,
  p_date_end    date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  -- Validate code-auth session
  SELECT user_id INTO v_teacher_id
  FROM public.active_sessions
  WHERE device_id = p_device_id
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active = true
    AND user_type = 'teacher'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Keine aktive Lehrer-Session');
  END IF;

  -- Verify teacher has access to this class
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_class_access
    WHERE teacher_id = v_teacher_id AND class_id = p_class_id
  ) THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  -- Return daily_results for all students in the class
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

REVOKE EXECUTE ON FUNCTION public.get_class_student_daily_results(text, text, uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_class_student_daily_results(text, text, uuid, date, date) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
