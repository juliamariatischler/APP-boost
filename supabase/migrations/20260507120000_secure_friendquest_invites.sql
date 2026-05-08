-- Secure Friendquest invite flow.
-- Critical state transitions are handled through SECURITY DEFINER RPCs.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.friendquest_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'awaiting_creator_confirmation', 'accepted', 'declined', 'expired', 'used')),
  invited_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  challenge_id uuid REFERENCES public.friend_challenges(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  confirmed_at timestamptz,
  declined_at timestamptz,
  used_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendquest_invites_not_self CHECK (invited_user_id IS NULL OR creator_user_id <> invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friendquest_invites_creator_created
  ON public.friendquest_invites (creator_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friendquest_invites_invited_created
  ON public.friendquest_invites (invited_user_id, created_at DESC)
  WHERE invited_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_friendquest_invites_pending_expiry
  ON public.friendquest_invites (status, expires_at);

CREATE TABLE IF NOT EXISTS public.friendquests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_id uuid REFERENCES public.friendquest_invites(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'in_progress', 'completed', 'cancelled')),
  selected_challenger_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  selected_challenge_id uuid REFERENCES public.friend_challenges(id) ON DELETE SET NULL,
  challenge_invitation_id uuid REFERENCES public.challenge_invitations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendquests_not_self CHECK (user_a_id <> user_b_id),
  CONSTRAINT friendquests_ordered_pair CHECK (user_a_id < user_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_friendquests_active_pair
  ON public.friendquests (user_a_id, user_b_id)
  WHERE status IN ('active', 'in_progress');

CREATE TABLE IF NOT EXISTS public.friendquest_invite_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_friendquest_invite_attempts_user_time
  ON public.friendquest_invite_attempts (user_id, attempted_at DESC);

ALTER TABLE public.friendquest_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendquests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendquest_invite_attempts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_friendquest_invites_updated_at ON public.friendquest_invites;
CREATE TRIGGER update_friendquest_invites_updated_at
BEFORE UPDATE ON public.friendquest_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_friendquests_updated_at ON public.friendquests;
CREATE TRIGGER update_friendquests_updated_at
BEFORE UPDATE ON public.friendquests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can view own friendquest invites" ON public.friendquest_invites;
CREATE POLICY "Users can view own friendquest invites"
ON public.friendquest_invites
FOR SELECT
TO authenticated
USING (auth.uid() = creator_user_id OR auth.uid() = invited_user_id);

DROP POLICY IF EXISTS "Users can view own friendquests" ON public.friendquests;
CREATE POLICY "Users can view own friendquests"
ON public.friendquests
FOR SELECT
TO authenticated
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Users can view own friendquest invite attempts" ON public.friendquest_invite_attempts;
CREATE POLICY "Users can view own friendquest invite attempts"
ON public.friendquest_invite_attempts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.friendquest_code_hash(p_code text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT encode(extensions.digest(upper(regexp_replace(trim(COALESCE(p_code, '')), '\s+', '', 'g')), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_friendquest_invites()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.friendquest_invites
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND expires_at <= now();
END;
$$;

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
  FROM public.friendquest_invites
  WHERE creator_user_id = v_user_id
    AND status IN ('pending', 'awaiting_creator_confirmation')
    AND expires_at > now();

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
      -- Extremely unlikely; retry with fresh random bytes.
    END;
  END LOOP;

  RAISE EXCEPTION 'Could not create invite';
END;
$$;

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
    invite_id := NULL;
    status := 'invalid';
    creator_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF length(v_code) < 8 OR length(v_code) > 24 THEN
    invite_id := NULL;
    status := 'invalid';
    creator_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM public.expire_stale_friendquest_invites();

  v_hash := public.friendquest_code_hash(v_code);

  SELECT *
  INTO v_invite
  FROM public.friendquest_invites
  WHERE invite_code_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND
    OR v_invite.status <> 'pending'
    OR v_invite.expires_at <= now()
    OR v_invite.creator_user_id = v_user_id
  THEN
    invite_id := NULL;
    status := 'invalid';
    creator_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  v_pair_a := LEAST(v_invite.creator_user_id, v_user_id);
  v_pair_b := GREATEST(v_invite.creator_user_id, v_user_id);

  IF EXISTS (
    SELECT 1
    FROM public.friendquests fq
    WHERE fq.user_a_id = v_pair_a
      AND fq.user_b_id = v_pair_b
      AND fq.status IN ('active', 'in_progress')
  ) OR EXISTS (
    SELECT 1
    FROM public.friendquest_invites fqi
    WHERE fqi.id <> v_invite.id
      AND fqi.status IN ('pending', 'awaiting_creator_confirmation')
      AND fqi.expires_at > now()
      AND (
        (fqi.creator_user_id = v_invite.creator_user_id AND fqi.invited_user_id = v_user_id)
        OR (fqi.creator_user_id = v_user_id AND fqi.invited_user_id = v_invite.creator_user_id)
      )
  ) THEN
    invite_id := NULL;
    status := 'invalid';
    creator_name := NULL;
    RETURN NEXT;
    RETURN;
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
    SELECT id
    FROM public.friendquest_invite_attempts
    WHERE user_id = v_user_id
    ORDER BY attempted_at DESC
    LIMIT 1
  );

  invite_id := v_invite.id;
  status := 'awaiting_creator_confirmation';
  SELECT username INTO creator_name
  FROM public.profiles
  WHERE id = v_invite.creator_user_id;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_friendquest_invite(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invite public.friendquest_invites%ROWTYPE;
  v_pair_a uuid;
  v_pair_b uuid;
  v_friendquest_id uuid;
  v_invitation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM public.expire_stale_friendquest_invites();

  SELECT *
  INTO v_invite
  FROM public.friendquest_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_invite.creator_user_id <> v_user_id
    OR v_invite.status <> 'awaiting_creator_confirmation'
    OR v_invite.invited_user_id IS NULL
    OR v_invite.expires_at <= now()
  THEN
    RAISE EXCEPTION 'Invite not available';
  END IF;

  v_pair_a := LEAST(v_invite.creator_user_id, v_invite.invited_user_id);
  v_pair_b := GREATEST(v_invite.creator_user_id, v_invite.invited_user_id);

  INSERT INTO public.friendquests (
    user_a_id,
    user_b_id,
    invite_id,
    selected_challenger_id,
    selected_challenge_id,
    status
  )
  VALUES (
    v_pair_a,
    v_pair_b,
    v_invite.id,
    v_invite.creator_user_id,
    v_invite.challenge_id,
    'active'
  )
  RETURNING id INTO v_friendquest_id;

  IF v_invite.challenge_id IS NOT NULL THEN
    INSERT INTO public.challenge_invitations (
      challenge_id,
      challenger_id,
      opponent_id,
      status
    )
    VALUES (
      v_invite.challenge_id,
      v_invite.creator_user_id,
      v_invite.invited_user_id,
      'accepted'
    )
    RETURNING id INTO v_invitation_id;

    UPDATE public.friendquests
    SET challenge_invitation_id = v_invitation_id,
        updated_at = now()
    WHERE id = v_friendquest_id;
  END IF;

  UPDATE public.friendquest_invites
  SET status = 'used',
      confirmed_at = now(),
      used_at = now(),
      updated_at = now()
  WHERE id = v_invite.id;

  RETURN v_friendquest_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Friendquest already active';
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_friendquest_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.friendquest_invites
  SET status = 'declined',
      declined_at = now(),
      updated_at = now()
  WHERE id = p_invite_id
    AND creator_user_id = v_user_id
    AND status = 'awaiting_creator_confirmation';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not available';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_friendquest_challenge(
  p_friendquest_id uuid,
  p_challenge_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_friendquest public.friendquests%ROWTYPE;
  v_invitation_id uuid;
  v_opponent_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT *
  INTO v_friendquest
  FROM public.friendquests
  WHERE id = p_friendquest_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_friendquest.status <> 'active'
    OR (v_friendquest.user_a_id <> v_user_id AND v_friendquest.user_b_id <> v_user_id)
  THEN
    RAISE EXCEPTION 'Friendquest not available';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.friend_challenges WHERE id = p_challenge_id) THEN
    RAISE EXCEPTION 'Invalid challenge';
  END IF;

  IF v_friendquest.challenge_invitation_id IS NOT NULL THEN
    RETURN v_friendquest.challenge_invitation_id;
  END IF;

  v_opponent_id := CASE
    WHEN v_friendquest.user_a_id = v_user_id THEN v_friendquest.user_b_id
    ELSE v_friendquest.user_a_id
  END;

  INSERT INTO public.challenge_invitations (
    challenge_id,
    challenger_id,
    opponent_id,
    status
  )
  VALUES (
    p_challenge_id,
    v_user_id,
    v_opponent_id,
    'accepted'
  )
  RETURNING id INTO v_invitation_id;

  UPDATE public.friendquests
  SET selected_challenger_id = v_user_id,
      selected_challenge_id = p_challenge_id,
      challenge_invitation_id = v_invitation_id,
      started_at = now(),
      updated_at = now()
  WHERE id = p_friendquest_id;

  RETURN v_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_friendquest_invites()
RETURNS TABLE(
  id uuid,
  creator_user_id uuid,
  invited_user_id uuid,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  accepted_at timestamptz,
  challenge_id uuid,
  challenge_name text,
  creator_name text,
  invited_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fqi.id,
    fqi.creator_user_id,
    fqi.invited_user_id,
    CASE
      WHEN fqi.status = 'pending' AND fqi.expires_at <= now() THEN 'expired'
      ELSE fqi.status
    END AS status,
    fqi.expires_at,
    fqi.created_at,
    fqi.accepted_at,
    fqi.challenge_id,
    fc.name AS challenge_name,
    creator.username AS creator_name,
    invited.username AS invited_name
  FROM public.friendquest_invites fqi
  LEFT JOIN public.friend_challenges fc ON fc.id = fqi.challenge_id
  JOIN public.profiles creator ON creator.id = fqi.creator_user_id
  LEFT JOIN public.profiles invited ON invited.id = fqi.invited_user_id
  WHERE auth.uid() = fqi.creator_user_id
     OR auth.uid() = fqi.invited_user_id
  ORDER BY fqi.created_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.get_my_friendquests()
RETURNS TABLE(
  id uuid,
  user_a_id uuid,
  user_b_id uuid,
  friend_name text,
  status text,
  selected_challenge_id uuid,
  challenge_name text,
  challenge_icon text,
  winner_points integer,
  loser_points integer,
  challenge_invitation_id uuid,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fq.id,
    fq.user_a_id,
    fq.user_b_id,
    CASE
      WHEN fq.user_a_id = auth.uid() THEN user_b.username
      ELSE user_a.username
    END AS friend_name,
    fq.status,
    fq.selected_challenge_id,
    fc.name AS challenge_name,
    fc.icon AS challenge_icon,
    fc.winner_points,
    fc.loser_points,
    fq.challenge_invitation_id,
    fq.created_at
  FROM public.friendquests fq
  JOIN public.profiles user_a ON user_a.id = fq.user_a_id
  JOIN public.profiles user_b ON user_b.id = fq.user_b_id
  LEFT JOIN public.friend_challenges fc ON fc.id = fq.selected_challenge_id
  WHERE auth.uid() = fq.user_a_id
     OR auth.uid() = fq.user_b_id
  ORDER BY fq.created_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.mark_friendquest_battle_ready(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation public.challenge_invitations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.challenge_invitations
  WHERE id = p_invitation_id
    AND (challenger_id = v_user_id OR opponent_id = v_user_id)
    AND status IN ('accepted', 'in_progress')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not available';
  END IF;

  IF v_invitation.challenger_id = v_user_id THEN
    UPDATE public.challenge_invitations
    SET challenger_ready = true,
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_invitation_id;
  ELSE
    UPDATE public.challenge_invitations
    SET opponent_ready = true,
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_invitation_id;
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.challenge_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF v_invitation.challenger_ready IS TRUE
    AND v_invitation.opponent_ready IS TRUE
    AND v_invitation.battle_started_at IS NULL
  THEN
    UPDATE public.challenge_invitations
    SET battle_started_at = now(),
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_invitation_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_friendquest_battle_result(
  p_invitation_id uuid,
  p_result integer
)
RETURNS TABLE(status text, winner_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation public.challenge_invitations%ROWTYPE;
  v_challenge public.friend_challenges%ROWTYPE;
  v_winner_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_result < 0 OR p_result > 10000 THEN
    RAISE EXCEPTION 'Invalid result';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.challenge_invitations
  WHERE id = p_invitation_id
    AND (challenger_id = v_user_id OR opponent_id = v_user_id)
    AND status = 'in_progress'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not available';
  END IF;

  IF v_invitation.challenger_id = v_user_id THEN
    IF v_invitation.challenger_result IS NOT NULL THEN
      RAISE EXCEPTION 'Result already submitted';
    END IF;

    UPDATE public.challenge_invitations
    SET challenger_result = p_result,
        updated_at = now()
    WHERE id = p_invitation_id;
  ELSE
    IF v_invitation.opponent_result IS NOT NULL THEN
      RAISE EXCEPTION 'Result already submitted';
    END IF;

    UPDATE public.challenge_invitations
    SET opponent_result = p_result,
        updated_at = now()
    WHERE id = p_invitation_id;
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.challenge_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF v_invitation.challenger_result IS NOT NULL
    AND v_invitation.opponent_result IS NOT NULL
    AND v_invitation.status <> 'completed'
  THEN
    IF v_invitation.challenger_result > v_invitation.opponent_result THEN
      v_winner_id := v_invitation.challenger_id;
    ELSIF v_invitation.opponent_result > v_invitation.challenger_result THEN
      v_winner_id := v_invitation.opponent_id;
    ELSE
      v_winner_id := NULL;
    END IF;

    SELECT *
    INTO v_challenge
    FROM public.friend_challenges
    WHERE id = v_invitation.challenge_id;

    UPDATE public.challenge_invitations
    SET status = 'completed',
        winner_id = v_winner_id,
        completed_at = now(),
        updated_at = now()
    WHERE id = p_invitation_id;

    IF v_winner_id IS NULL THEN
      INSERT INTO public.point_awards (user_id, points, source)
      VALUES
        (v_invitation.challenger_id, LEAST(v_challenge.loser_points, 50), 'friendquest_battle'),
        (v_invitation.opponent_id, LEAST(v_challenge.loser_points, 50), 'friendquest_battle');

      UPDATE public.profiles
      SET points = points + LEAST(v_challenge.loser_points, 50),
          updated_at = now()
      WHERE id IN (v_invitation.challenger_id, v_invitation.opponent_id);
    ELSE
      INSERT INTO public.point_awards (user_id, points, source)
      VALUES
        (
          v_invitation.challenger_id,
          CASE WHEN v_winner_id = v_invitation.challenger_id THEN LEAST(v_challenge.winner_points, 50) ELSE LEAST(v_challenge.loser_points, 50) END,
          'friendquest_battle'
        ),
        (
          v_invitation.opponent_id,
          CASE WHEN v_winner_id = v_invitation.opponent_id THEN LEAST(v_challenge.winner_points, 50) ELSE LEAST(v_challenge.loser_points, 50) END,
          'friendquest_battle'
        );

      UPDATE public.profiles
      SET points = points + CASE
          WHEN id = v_winner_id THEN LEAST(v_challenge.winner_points, 50)
          ELSE LEAST(v_challenge.loser_points, 50)
        END,
          updated_at = now()
      WHERE id IN (v_invitation.challenger_id, v_invitation.opponent_id);
    END IF;
  END IF;

  SELECT ci.status, ci.winner_id
  INTO status, winner_id
  FROM public.challenge_invitations ci
  WHERE ci.id = p_invitation_id;

  RETURN NEXT;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.challenge_invitations FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.friendquest_code_hash(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_stale_friendquest_invites() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_friendquest_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_friendquest_invite(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_friendquest_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decline_friendquest_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_friendquest_challenge(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_friendquest_invites() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_friendquests() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_friendquest_battle_ready(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_friendquest_battle_result(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_friendquest_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_friendquest_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_friendquest_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_friendquest_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_friendquest_challenge(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_friendquest_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_friendquests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_friendquest_battle_ready(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_friendquest_battle_result(uuid, integer) TO authenticated;
