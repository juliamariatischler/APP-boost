-- Move remaining admin write paths behind validated RPCs.

CREATE OR REPLACE FUNCTION public.admin_assign_student(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid := auth.uid();
BEGIN
  IF v_teacher_id IS NULL OR NOT public.has_role(v_teacher_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  IF public.is_demo_user(v_teacher_id) AND NOT public.is_demo_profile(p_student_id) THEN
    RAISE EXCEPTION 'Unauthorized: Demo teacher is limited to demo students';
  END IF;

  INSERT INTO public.teacher_student_assignments (teacher_id, student_id, created_by)
  VALUES (v_teacher_id, p_student_id, v_teacher_id)
  ON CONFLICT (teacher_id, student_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unassign_student(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid := auth.uid();
BEGIN
  IF v_teacher_id IS NULL OR NOT public.has_role(v_teacher_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  IF public.is_demo_user(v_teacher_id) AND NOT public.is_demo_profile(p_student_id) THEN
    RAISE EXCEPTION 'Unauthorized: Demo teacher is limited to demo students';
  END IF;

  DELETE FROM public.teacher_student_assignments
  WHERE teacher_id = v_teacher_id
    AND student_id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_school_registration_request(
  p_request_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  IF public.is_demo_user(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: Demo teacher cannot review school requests';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.school_registration_requests
  SET status = p_status,
      reviewed_at = now(),
      reviewed_by = v_admin_id
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_reward_redemption(
  p_request_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_user_id uuid;
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT user_id
  INTO v_user_id
  FROM public.reward_redemptions
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward redemption not found';
  END IF;

  IF public.is_demo_user(v_admin_id) AND NOT public.is_demo_profile(v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Demo teacher is limited to demo reward requests';
  END IF;

  UPDATE public.reward_redemptions
  SET status = p_status,
      reviewed_at = now(),
      reviewed_by = v_admin_id
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_reward_item(
  p_title text,
  p_partner text,
  p_threshold integer,
  p_category text,
  p_icon text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_reward_id uuid;
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin') OR public.is_demo_user(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  IF length(trim(COALESCE(p_title, ''))) = 0 OR p_threshold <= 0 THEN
    RAISE EXCEPTION 'Invalid reward payload';
  END IF;

  INSERT INTO public.reward_items (title, partner, threshold, category, icon, is_active)
  VALUES (
    left(trim(p_title), 120),
    NULLIF(left(trim(COALESCE(p_partner, '')), 120), ''),
    p_threshold,
    COALESCE(NULLIF(left(trim(COALESCE(p_category, '')), 80), ''), 'allgemein'),
    NULLIF(left(trim(COALESCE(p_icon, '')), 16), ''),
    true
  )
  RETURNING id INTO v_reward_id;

  RETURN v_reward_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_reward_item_active(
  p_reward_id uuid,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin') OR public.is_demo_user(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  UPDATE public.reward_items
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_reward_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_class_milestone(
  p_threshold integer,
  p_title text,
  p_description text,
  p_icon text,
  p_sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_milestone_id uuid;
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin') OR public.is_demo_user(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  IF length(trim(COALESCE(p_title, ''))) = 0 OR p_threshold <= 0 THEN
    RAISE EXCEPTION 'Invalid milestone payload';
  END IF;

  INSERT INTO public.class_milestones (threshold, title, description, icon, sort_order, is_active)
  VALUES (
    p_threshold,
    left(trim(p_title), 120),
    NULLIF(left(trim(COALESCE(p_description, '')), 500), ''),
    NULLIF(left(trim(COALESCE(p_icon, '')), 16), ''),
    COALESCE(p_sort_order, 1),
    true
  )
  RETURNING id INTO v_milestone_id;

  RETURN v_milestone_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_class_milestone_active(
  p_milestone_id uuid,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF v_admin_id IS NULL OR NOT public.has_role(v_admin_id, 'admin') OR public.is_demo_user(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  UPDATE public.class_milestones
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_milestone_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assign_student(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_unassign_student(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.review_school_registration_request(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.review_reward_redemption(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_reward_item(text, text, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_reward_item_active(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_class_milestone(integer, text, text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_class_milestone_active(uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_assign_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unassign_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_school_registration_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_reward_redemption(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_reward_item(text, text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_reward_item_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_class_milestone(integer, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_class_milestone_active(uuid, boolean) TO authenticated;
