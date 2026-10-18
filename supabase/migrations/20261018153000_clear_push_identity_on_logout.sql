CREATE OR REPLACE FUNCTION public.clear_push_subscription_identity(
  p_installation_id text,
  p_device_id text,
  p_session_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(trim(p_installation_id), '') = ''
     OR coalesce(trim(p_device_id), '') = ''
     OR coalesce(p_session_token, '') = '' THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.active_sessions
    WHERE device_id = trim(p_device_id)
      AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      AND active = true AND expires_at > now()
  ) THEN RETURN false; END IF;
  UPDATE public.push_subscriptions
  SET user_id = null, user_type = null, class_id = null, device_id = null, last_seen_at = now()
  WHERE installation_id = trim(p_installation_id) AND device_id = trim(p_device_id);
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clear_push_subscription_identity(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_push_subscription_identity(text,text,text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
