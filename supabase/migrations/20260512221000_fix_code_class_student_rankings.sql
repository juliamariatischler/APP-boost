-- Fix: get_code_class_student_rankings filtered with active = true, which excluded
-- students who haven't activated their QR yet. Match the same filter as
-- get_code_class_quest_progress (deactivated_at IS NULL only).

CREATE OR REPLACE FUNCTION public.get_code_class_student_rankings(
  p_device_id     text,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session  public.active_sessions%ROWTYPE;
  v_student  public.students%ROWTYPE;
  v_class    public.classes%ROWTYPE;
  v_result   jsonb;
BEGIN
  SELECT * INTO v_session
  FROM   public.active_sessions
  WHERE  device_id          = trim(p_device_id)
    AND  session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND  active             = true
    AND  user_type          = 'student'
    AND  COALESCE(expires_at, now() + interval '1 day') > now()
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Schueler-Session');
  END IF;

  SELECT * INTO v_student
  FROM   public.students
  WHERE  id = v_session.user_id AND deactivated_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Schueler nicht gefunden'); END IF;

  SELECT * INTO v_class FROM public.classes WHERE id = v_student.class_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Klasse nicht gefunden'); END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',       id,
      'username', display_name,
      'points',   COALESCE(points, 0)
    )
    ORDER BY COALESCE(points, 0) DESC, display_name ASC
  ), '[]'::jsonb)
  INTO v_result
  FROM public.students
  WHERE class_id      = v_class.id
    AND deactivated_at IS NULL;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_code_class_student_rankings(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_code_class_student_rankings(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
