-- Production-ready push management for central admins.

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS installation_id text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

UPDATE public.push_subscriptions
SET installation_id = device_id
WHERE installation_id IS NULL AND device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS push_subscriptions_installation_idx
  ON public.push_subscriptions (installation_id);

ALTER TABLE public.push_messages DROP CONSTRAINT IF EXISTS push_messages_status_check;
ALTER TABLE public.push_messages
  ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS action_value text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS processing_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempted_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT push_messages_action_type_check
    CHECK (action_type IN ('none', 'store', 'internal', 'web'));

UPDATE public.push_messages
SET status = 'processing'
WHERE status = 'sending';

ALTER TABLE public.push_messages
  ADD CONSTRAINT push_messages_status_check
  CHECK (status IN ('pending', 'sending', 'processing', 'sent', 'partially_failed', 'failed', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.push_message_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.push_messages(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  status text NOT NULL CHECK (status IN ('accepted', 'failed')),
  provider_message_id text,
  error text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_message_deliveries_message_idx
  ON public.push_message_deliveries (message_id, status);

ALTER TABLE public.push_message_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Central admins can read push messages" ON public.push_messages;
CREATE POLICY "Central admins can read push messages"
ON public.push_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()));

DROP POLICY IF EXISTS "Central admins can read push deliveries" ON public.push_message_deliveries;
CREATE POLICY "Central admins can read push deliveries"
ON public.push_message_deliveries FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND NOT public.is_demo_user(auth.uid()));

DROP FUNCTION IF EXISTS public.register_push_subscription(text, text, text, text);

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_push_token text,
  p_platform text,
  p_device_id text DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_installation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_session public.active_sessions%ROWTYPE;
  v_user_id uuid;
  v_user_type text;
  v_class_id uuid;
  v_installation_id text := nullif(trim(coalesce(p_installation_id, p_device_id, '')), '');
BEGIN
  IF coalesce(trim(p_push_token), '') = '' OR v_installation_id IS NULL THEN
    RETURN jsonb_build_object('error', 'push_token oder installation_id fehlt');
  END IF;
  IF p_platform NOT IN ('ios', 'android') THEN
    RETURN jsonb_build_object('error', 'platform muss ios oder android sein');
  END IF;

  IF v_auth_user_id IS NOT NULL THEN
    v_user_id := v_auth_user_id;
    SELECT 'student', s.class_id INTO v_user_type, v_class_id
      FROM public.students s WHERE s.auth_user_id = v_auth_user_id LIMIT 1;
    IF v_user_type IS NULL AND public.has_role(v_auth_user_id, 'admin') THEN
      v_user_type := 'teacher';
    END IF;
  ELSIF coalesce(p_device_id, '') <> '' AND coalesce(p_session_token, '') <> '' THEN
    SELECT * INTO v_session FROM public.active_sessions
      WHERE device_id = trim(p_device_id)
        AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
        AND active = true AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
      v_user_id := v_session.user_id;
      v_user_type := v_session.user_type;
      IF v_user_type = 'student' THEN
        SELECT s.class_id INTO v_class_id FROM public.students s WHERE s.id = v_user_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.push_subscriptions
    (push_token, platform, device_id, installation_id, user_id, user_type, class_id,
     is_active, disabled_at, last_seen_at)
  VALUES
    (trim(p_push_token), p_platform, p_device_id, v_installation_id, v_user_id,
     v_user_type, v_class_id, true, null, now())
  ON CONFLICT (push_token) DO UPDATE SET
    platform = excluded.platform,
    device_id = coalesce(excluded.device_id, push_subscriptions.device_id),
    installation_id = excluded.installation_id,
    user_id = coalesce(excluded.user_id, push_subscriptions.user_id),
    user_type = coalesce(excluded.user_type, push_subscriptions.user_type),
    class_id = coalesce(excluded.class_id, push_subscriptions.class_id),
    is_active = true,
    disabled_at = null,
    last_seen_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_push_subscription(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text,text,text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_push_message(
  p_title text,
  p_body text,
  p_target text,
  p_target_class_id uuid DEFAULT NULL,
  p_action_type text DEFAULT 'none',
  p_action_value text DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') OR public.is_demo_user(auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff';
  END IF;
  IF length(trim(p_title)) NOT BETWEEN 1 AND 80 OR length(trim(p_body)) NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'Titel oder Nachricht hat eine ungültige Länge';
  END IF;
  IF p_target NOT IN ('all', 'student', 'teacher', 'class') THEN RAISE EXCEPTION 'Ungültige Zielgruppe'; END IF;
  IF p_target = 'class' AND p_target_class_id IS NULL THEN RAISE EXCEPTION 'Klasse fehlt'; END IF;
  IF p_action_type NOT IN ('none', 'store', 'internal', 'web') THEN RAISE EXCEPTION 'Ungültige Aktion'; END IF;
  IF p_action_type = 'internal' AND coalesce(p_action_value, '') !~ '^/[A-Za-z0-9_/?=&.-]*$' THEN
    RAISE EXCEPTION 'Ungültiger interner Pfad';
  END IF;
  IF p_action_type = 'web' AND coalesce(p_action_value, '') !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Weblinks müssen HTTPS verwenden';
  END IF;

  INSERT INTO public.push_messages
    (title, body, target, target_class_id, action_type, action_value, cta_url,
     scheduled_at, status, created_by)
  VALUES
    (trim(p_title), trim(p_body), p_target, p_target_class_id, p_action_type,
     nullif(trim(coalesce(p_action_value, '')), ''),
     CASE p_action_type WHEN 'store' THEN 'store' ELSE nullif(trim(coalesce(p_action_value, '')), '') END,
     greatest(coalesce(p_scheduled_at, now()), now()), 'pending', auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_push_message(p_message_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') OR public.is_demo_user(auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff';
  END IF;
  UPDATE public.push_messages SET status = 'cancelled'
    WHERE id = p_message_id AND status = 'pending';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_push_classes()
RETURNS TABLE (id uuid, class_name text, school_name text, subscriber_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') OR public.is_demo_user(auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff';
  END IF;
  RETURN QUERY
    SELECT c.id, c.name, s.name, count(ps.id)
    FROM public.classes c
    JOIN public.schools s ON s.id = c.school_id
    LEFT JOIN public.push_subscriptions ps ON ps.class_id = c.id AND ps.is_active = true
    WHERE c.active = true AND s.active = true
    GROUP BY c.id, c.name, s.name
    ORDER BY s.name, c.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_push_message(text,text,text,uuid,text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_push_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_push_classes() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_due_push_messages(p_limit integer DEFAULT 20)
RETURNS SETOF public.push_messages
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.push_messages m SET status = 'processing', processing_at = now()
  WHERE m.id IN (
    SELECT id FROM public.push_messages
    WHERE status = 'pending' AND scheduled_at <= now()
    ORDER BY scheduled_at FOR UPDATE SKIP LOCKED LIMIT greatest(1, least(p_limit, 100))
  ) RETURNING m.*;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_due_push_messages(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_push_messages(integer) TO service_role;

NOTIFY pgrst, 'reload schema';
