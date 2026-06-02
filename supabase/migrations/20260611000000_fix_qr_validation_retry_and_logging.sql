-- Fix QR-Code Validierung:
-- 1. prepare_student_qr_registration erlaubt Retry für denselben Auth-User
--    (z.B. bei Netzwerkfehler nach complete_student_qr_registration)
-- 2. Security-Event-Logging für alle fehlgeschlagenen Scan-Versuche
-- 3. Klarere Fehlermeldungen: "bereits verwendet" vs. "ungültig"

CREATE OR REPLACE FUNCTION public.prepare_student_qr_registration(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash        text;
  v_student     public.students%ROWTYPE;
  v_class       public.classes%ROWTYPE;
  v_school      public.schools%ROWTYPE;
  v_caller_uid  uuid;
BEGIN
  p_code        := upper(trim(p_code));
  v_caller_uid  := auth.uid();

  IF p_code = '' THEN
    RETURN jsonb_build_object('error', 'Ungueltiger Aktivierungscode');
  END IF;

  v_hash := public.hash_activation_code(p_code);

  SELECT * INTO v_student
  FROM public.students
  WHERE activation_code_hash = v_hash
  ORDER BY activation_code_created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Jeder fehlgeschlagene Versuch wird geloggt (für Diagnose)
    INSERT INTO public.student_security_events (event_type, metadata)
    VALUES ('invalid_qr_code', jsonb_build_object(
      'reason',            'hash_not_found',
      'caller_uid',        v_caller_uid,
      'code_hash_prefix',  substr(v_hash, 1, 8)
    ));
    RETURN jsonb_build_object('error', 'Ungueltiger Aktivierungscode');
  END IF;

  IF v_student.activation_code_used_at IS NOT NULL THEN
    -- Retry erlauben wenn DERSELBE authentifizierte User nochmals scannt
    -- (z.B. Netzwerkfehler nach complete_student_qr_registration)
    IF v_caller_uid IS NOT NULL AND v_student.auth_user_id = v_caller_uid THEN
      -- Gleicher User: Retry erlaubt, weitermachen
      NULL;
    ELSE
      INSERT INTO public.student_security_events (student_id, event_type, metadata)
      VALUES (v_student.id, 'already_used_qr_code', jsonb_build_object(
        'reason',                'code_already_used',
        'caller_uid',            v_caller_uid,
        'student_auth_user_id',  v_student.auth_user_id
      ));
      RETURN jsonb_build_object('error', 'QR-Code wurde bereits verwendet – bitte Lehrkraft um neuen Code bitten');
    END IF;
  END IF;

  IF COALESCE(v_student.active, true) = false OR v_student.deactivated_at IS NOT NULL THEN
    INSERT INTO public.student_security_events (student_id, event_type, metadata)
    VALUES (v_student.id, 'student_deactivated', jsonb_build_object(
      'caller_uid',    v_caller_uid,
      'active',        v_student.active,
      'deactivated_at', v_student.deactivated_at
    ));
    RETURN jsonb_build_object('error', 'Dieses Profil ist deaktiviert');
  END IF;

  SELECT * INTO v_class  FROM public.classes WHERE id = v_student.class_id;
  SELECT * INTO v_school FROM public.schools WHERE id = v_class.school_id;

  RETURN jsonb_build_object(
    'student_id',   v_student.id,
    'display_name', v_student.display_name,
    'first_name',   v_student.first_name,
    'class_id',     v_class.id,
    'class_name',   v_class.name,
    'school_name',  v_school.name,
    'email',        'qr-' || replace(v_student.id::text, '-', '') || '-' || substr(v_hash, 1, 12) || '@qr.boost-schule.app'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_student_qr_registration(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.prepare_student_qr_registration(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
