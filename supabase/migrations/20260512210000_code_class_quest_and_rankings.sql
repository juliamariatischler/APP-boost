-- RPCs for code-auth students to access class quest progress and class rankings.
-- Parallel to the JWT-auth versions but authenticate via device_id + session_token.

-- ─── Class quest progress ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_code_class_quest_progress(
  p_device_id     text,
  p_session_token text,
  p_month_start   date DEFAULT (date_trunc('month', timezone('Europe/Vienna', now())))::date
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
  v_school   public.schools%ROWTYPE;
  v_mstart   date;
  v_mend     date;
  v_goal     integer := 1000;
  v_total    integer := 0;
  v_rows     jsonb;
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
  WHERE  id = v_session.user_id AND active = true AND deactivated_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Schueler nicht aktiv'); END IF;

  SELECT * INTO v_class  FROM public.classes WHERE id = v_student.class_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Klasse nicht gefunden'); END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = v_class.school_id;

  v_mstart := date_trunc('month',
    COALESCE(p_month_start, timezone('Europe/Vienna', now())::date)::timestamp
  )::date;
  v_mend := (v_mstart + interval '1 month')::date;

  SELECT COALESCE(SUM(COALESCE(dr.squats, 0)), 0)::integer
  INTO   v_total
  FROM   public.students s
  LEFT JOIN public.daily_results dr
         ON dr.user_id = s.id
        AND dr.date   >= v_mstart
        AND dr.date    < v_mend
  WHERE  s.class_id      = v_class.id
    AND  s.deactivated_at IS NULL;

  WITH per_student AS (
    SELECT
      s.id                                                    AS sid,
      s.display_name                                          AS uname,
      COALESCE(SUM(COALESCE(dr.squats, 0)), 0)::integer       AS contribution
    FROM   public.students s
    LEFT JOIN public.daily_results dr
           ON dr.user_id = s.id
          AND dr.date   >= v_mstart
          AND dr.date    < v_mend
    WHERE  s.class_id      = v_class.id
      AND  s.deactivated_at IS NULL
    GROUP BY s.id, s.display_name
  ),
  ranked AS (
    SELECT sid, uname, contribution,
           row_number() OVER (ORDER BY contribution DESC, uname ASC)::integer AS rnk
    FROM per_student
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'student_id',    sid,
      'username',      uname,
      'contribution',  contribution,
      'class_name',    v_class.name,
      'school_name',   v_school.name,
      'class_total',   v_total,
      'goal',          v_goal,
      'rank_position', rnk
    )
    ORDER BY rnk
  ), '[]'::jsonb)
  INTO v_rows
  FROM ranked;

  RETURN jsonb_build_object(
    'class_total', v_total,
    'goal',        v_goal,
    'class_name',  v_class.name,
    'school_name', v_school.name,
    'rows',        v_rows
  );
END;
$$;

-- ─── Class student rankings ──────────────────────────────────────────────────

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
  WHERE  id = v_session.user_id AND active = true AND deactivated_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Schueler nicht aktiv'); END IF;

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
    AND active        = true
    AND deactivated_at IS NULL;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_code_class_quest_progress(text, text, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_code_class_student_rankings(text, text)     FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_code_class_quest_progress(text, text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_code_class_student_rankings(text, text)     TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
