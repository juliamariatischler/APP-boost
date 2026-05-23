-- Limit Friendquest battle point awards to 2 per user per day.
-- Points are only awarded when a user hasn't already received 2 friendquest_battle
-- awards since the start of today (UTC). The battle result and winner are still
-- determined normally; only point insertion is skipped when the limit is reached.

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
  v_user_id          uuid := auth.uid();
  v_invitation       public.challenge_invitations%ROWTYPE;
  v_challenge        public.friend_challenges%ROWTYPE;
  v_winner_id        uuid;
  v_today_start      timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_challenger_daily integer;
  v_opponent_daily   integer;
  v_challenger_pts   integer;
  v_opponent_pts     integer;
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

    -- Count today's friendquest_battle awards per participant.
    SELECT count(*) INTO v_challenger_daily
    FROM public.point_awards
    WHERE user_id = v_invitation.challenger_id
      AND source = 'friendquest_battle'
      AND created_at >= v_today_start;

    SELECT count(*) INTO v_opponent_daily
    FROM public.point_awards
    WHERE user_id = v_invitation.opponent_id
      AND source = 'friendquest_battle'
      AND created_at >= v_today_start;

    -- Determine points for each user (0 if daily limit of 2 already reached).
    IF v_winner_id IS NULL THEN
      v_challenger_pts := CASE WHEN v_challenger_daily < 2 THEN LEAST(v_challenge.loser_points, 50) ELSE 0 END;
      v_opponent_pts   := CASE WHEN v_opponent_daily   < 2 THEN LEAST(v_challenge.loser_points, 50) ELSE 0 END;
    ELSE
      v_challenger_pts := CASE WHEN v_challenger_daily < 2 THEN
        CASE WHEN v_winner_id = v_invitation.challenger_id
          THEN LEAST(v_challenge.winner_points, 50)
          ELSE LEAST(v_challenge.loser_points,  50)
        END
      ELSE 0 END;

      v_opponent_pts := CASE WHEN v_opponent_daily < 2 THEN
        CASE WHEN v_winner_id = v_invitation.opponent_id
          THEN LEAST(v_challenge.winner_points, 50)
          ELSE LEAST(v_challenge.loser_points,  50)
        END
      ELSE 0 END;
    END IF;

    IF v_challenger_pts > 0 THEN
      INSERT INTO public.point_awards (user_id, points, source)
      VALUES (v_invitation.challenger_id, v_challenger_pts, 'friendquest_battle');

      UPDATE public.profiles
      SET points = points + v_challenger_pts,
          updated_at = now()
      WHERE id = v_invitation.challenger_id;
    END IF;

    IF v_opponent_pts > 0 THEN
      INSERT INTO public.point_awards (user_id, points, source)
      VALUES (v_invitation.opponent_id, v_opponent_pts, 'friendquest_battle');

      UPDATE public.profiles
      SET points = points + v_opponent_pts,
          updated_at = now()
      WHERE id = v_invitation.opponent_id;
    END IF;
  END IF;

  SELECT ci.status, ci.winner_id
  INTO status, winner_id
  FROM public.challenge_invitations ci
  WHERE ci.id = p_invitation_id;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_friendquest_battle_result(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_friendquest_battle_result(uuid, integer) TO authenticated;
