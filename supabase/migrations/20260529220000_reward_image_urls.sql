-- Add image_url and sponsor_logo_url to reward_items

ALTER TABLE public.reward_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS sponsor_logo_url text;

-- Replace create_reward_item to accept the two new optional parameters
CREATE OR REPLACE FUNCTION public.create_reward_item(
  p_title text,
  p_partner text,
  p_threshold integer,
  p_category text,
  p_icon text,
  p_image_url text DEFAULT NULL,
  p_sponsor_logo_url text DEFAULT NULL
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

  INSERT INTO public.reward_items (title, partner, threshold, category, icon, image_url, sponsor_logo_url, is_active)
  VALUES (
    left(trim(p_title), 120),
    NULLIF(left(trim(COALESCE(p_partner, '')), 120), ''),
    p_threshold,
    COALESCE(NULLIF(left(trim(COALESCE(p_category, '')), 80), ''), 'allgemein'),
    NULLIF(left(trim(COALESCE(p_icon, '')), 16), ''),
    NULLIF(trim(COALESCE(p_image_url, '')), ''),
    NULLIF(trim(COALESCE(p_sponsor_logo_url, '')), ''),
    true
  )
  RETURNING id INTO v_reward_id;

  RETURN v_reward_id;
END;
$$;

-- RPC to update image URLs on an existing reward (admin only)
CREATE OR REPLACE FUNCTION public.update_reward_item_images(
  p_reward_id uuid,
  p_image_url text DEFAULT NULL,
  p_sponsor_logo_url text DEFAULT NULL
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
  SET image_url        = NULLIF(trim(COALESCE(p_image_url, '')), ''),
      sponsor_logo_url = NULLIF(trim(COALESCE(p_sponsor_logo_url, '')), ''),
      updated_at       = now()
  WHERE id = p_reward_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_reward_item_images(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_reward_item_images(uuid, text, text) TO authenticated;
