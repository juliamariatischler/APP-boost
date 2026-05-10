-- Fix: "column reference expires_at is ambiguous" in create_friendquest_invite.
-- The RETURNS TABLE has an OUT column named expires_at which conflicts with
-- the same-named column in friendquest_invites. Fix by aliasing the table.

CREATE OR REPLACE FUNCTION public.create_friendquest_invite(p_challenge_id uuid DEFAULT NULL)
RETURNS TABLE(invite_id uuid, invite_code text, expires_at timestamptz, challenge_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
  v_hash text;
  v_expires_at timestamptz := now() + interval '15 minutes';
  v_challenge_name text;
  v_existing_active_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM public.expire_stale_friendquest_invites();

  IF p_challenge_id IS NOT NULL THEN
    SELECT name INTO v_challenge_name
    FROM public.friend_challenges
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid challenge';
    END IF;
  END IF;

  SELECT count(*)
  INTO v_existing_active_count
  FROM public.friendquest_invites fi
  WHERE fi.creator_user_id = v_user_id
    AND fi.status IN ('pending', 'awaiting_creator_confirmation')
    AND fi.expires_at > now();

  IF v_existing_active_count >= 3 THEN
    RAISE EXCEPTION 'Too many active invites';
  END IF;

  FOR i IN 1..5 LOOP
    v_code := upper(substr(encode(extensions.gen_random_bytes(9), 'base64'), 1, 12));
    v_code := replace(replace(replace(v_code, '/', 'A'), '+', 'B'), '=', '');
    v_hash := public.friendquest_code_hash(v_code);

    BEGIN
      INSERT INTO public.friendquest_invites (
        creator_user_id,
        invite_code_hash,
        challenge_id,
        expires_at
      )
      VALUES (
        v_user_id,
        v_hash,
        p_challenge_id,
        v_expires_at
      )
      RETURNING id INTO invite_id;

      invite_code := v_code;
      expires_at := v_expires_at;
      challenge_name := v_challenge_name;
      RETURN NEXT;
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- retry
    END;
  END LOOP;

  RAISE EXCEPTION 'Could not create invite';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_friendquest_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_friendquest_invite(uuid) TO authenticated;
