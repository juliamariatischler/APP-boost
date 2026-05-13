-- Teacher overview must read progress from the auth profile after QR activation.
-- Keep student_id as the management/QR row id, and expose progress_user_id for
-- daily_results/profiles lookups.

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
      'student_id', s.id,
      'auth_user_id', s.auth_user_id,
      'progress_user_id', COALESCE(s.auth_user_id, s.id),
      'display_name', s.display_name,
      'first_name', s.first_name,
      'points', COALESCE(p.points, s.points, 0),
      'active', s.active,
      'activated_at', s.activated_at,
      'device_id', s.device_id,
      'activation_code_created_at', s.activation_code_created_at,
      'activation_code_used_at', s.activation_code_used_at
    )
    ORDER BY s.display_name
  ) INTO v_result
  FROM public.students s
  LEFT JOIN public.profiles p
    ON p.id = s.auth_user_id
  WHERE s.class_id = p_class_id
    AND s.deactivated_at IS NULL;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_class_students(
  p_device_id text,
  p_session_token text,
  p_class_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.active_sessions%ROWTYPE;
  v_access boolean;
  v_result jsonb;
BEGIN
  SELECT * INTO v_session
  FROM public.active_sessions
  WHERE device_id = p_device_id
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND active = true
    AND user_type = 'teacher'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Lehrer-Session');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.teacher_class_access
    WHERE teacher_id = v_session.user_id
      AND class_id = p_class_id
  ) INTO v_access;

  IF NOT v_access THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'student_id', s.id,
      'auth_user_id', s.auth_user_id,
      'progress_user_id', COALESCE(s.auth_user_id, s.id),
      'display_name', s.display_name,
      'first_name', s.first_name,
      'points', COALESCE(p.points, s.points, 0),
      'active', s.active,
      'activated_at', s.activated_at,
      'device_id', s.device_id,
      'activation_code_created_at', s.activation_code_created_at,
      'activation_code_used_at', s.activation_code_used_at
    )
    ORDER BY s.display_name
  ) INTO v_result
  FROM public.students s
  LEFT JOIN public.profiles p
    ON p.id = s.auth_user_id
  WHERE s.class_id = p_class_id
    AND s.deactivated_at IS NULL;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_get_students_auth(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_class_students(text, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.teacher_get_students_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_students(text, text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
