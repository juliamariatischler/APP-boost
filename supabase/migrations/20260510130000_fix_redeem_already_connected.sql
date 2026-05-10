-- Return 'already_connected' instead of 'invalid' when users already have an active friendquest.

CREATE OR REPLACE FUNCTION public.redeem_friendquest_invite(p_code text)
RETURNS TABLE(invite_id uuid, status text, creator_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text := upper(regexp_replace(trim(COALESCE(p_code, '')), '\s+', '', 'g'));
  v_hash text;
  v_invite public.friendquest_invites%ROWTYPE;
  v_recent_attempts integer;
  v_pair_a uuid;
  v_pair_b uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*)
  INTO v_recent_attempts
  FROM public.friendquest_invite_attempts
  WHERE user_id = v_user_id
    AND attempted_at > now() - interval '10 minutes';

  INSERT INTO public.friendquest_invite_attempts (user_id, success)
  VALUES (v_user_id, false);

  IF v_recent_attempts >= 8 THEN
    invite_id := NULL; status := 'invalid'; creator_name := NULL;
    RETURN NEXT; RETURN;
  END IF;

  IF length(v_code) < 8 OR length(v_code) > 24 THEN
    invite_id := NULL; status := 'invalid'; creator_name := NULL;
    RETURN NEXT; RETURN;
  END IF;

  PERFORM public.expire_stale_friendquest_invites();

  v_hash := public.friendquest_code_hash(v_code);

  SELECT *
  INTO v_invite
  FROM public.friendquest_invites fi
  WHERE fi.invite_code_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND
    OR v_invite.status <> 'pending'
    OR v_invite.expires_at <= now()
    OR v_invite.creator_user_id = v_user_id
  THEN
    invite_id := NULL; status := 'invalid'; creator_name := NULL;
    RETURN NEXT; RETURN;
  END IF;

  v_pair_a := LEAST(v_invite.creator_user_id, v_user_id);
  v_pair_b := GREATEST(v_invite.creator_user_id, v_user_id);

  -- Already have an active friendquest together
  IF EXISTS (
    SELECT 1 FROM public.friendquests fq
    WHERE fq.user_a_id = v_pair_a AND fq.user_b_id = v_pair_b
      AND fq.status IN ('active', 'in_progress')
  ) OR EXISTS (
    SELECT 1 FROM public.friendquest_invites fqi
    WHERE fqi.id <> v_invite.id
      AND fqi.status IN ('pending', 'awaiting_creator_confirmation')
      AND fqi.expires_at > now()
      AND (
        (fqi.creator_user_id = v_invite.creator_user_id AND fqi.invited_user_id = v_user_id)
        OR (fqi.creator_user_id = v_user_id AND fqi.invited_user_id = v_invite.creator_user_id)
      )
  ) THEN
    invite_id := NULL; status := 'already_connected'; creator_name := NULL;
    RETURN NEXT; RETURN;
  END IF;

  UPDATE public.friendquest_invites
  SET status = 'awaiting_creator_confirmation',
      invited_user_id = v_user_id,
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_invite.id;

  UPDATE public.friendquest_invite_attempts
  SET success = true
  WHERE id = (
    SELECT id FROM public.friendquest_invite_attempts
    WHERE user_id = v_user_id
    ORDER BY attempted_at DESC LIMIT 1
  );

  invite_id := v_invite.id;
  status := 'awaiting_creator_confirmation';
  SELECT username INTO creator_name
  FROM public.profiles WHERE id = v_invite.creator_user_id;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_friendquest_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_friendquest_invite(text) TO authenticated;
