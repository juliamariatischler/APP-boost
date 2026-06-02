-- Fix submit_friendquest_battle_result:
-- 1. Wrong column name: boost_points → points (boost_points does not exist, points were silently lost)
-- 2. Remove the hardcoded 50-rep minimum (breaks push-up/squat battles whose goal is only 30)
--    New rule: award points to any participant who submitted p_result > 0 (they actually exercised)

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

  -- Lock the invitation row for the duration of this transaction
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

  -- Write this user's result
  IF v_invitation.challenger_id = v_user_id THEN
    IF v_invitation.challenger_result IS NOT NULL THEN
      RAISE EXCEPTION 'Result already submitted';
    END IF;

    UPDATE public.challenge_invitations
    SET challenger_result = p_result,
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_invitation_id;
  ELSE
    IF v_invitation.opponent_result IS NOT NULL THEN
      RAISE EXCEPTION 'Result already submitted';
    END IF;

    UPDATE public.challenge_invitations
    SET opponent_result = p_result,
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_invitation_id;
  END IF;

  -- Re-fetch with lock to get the freshest state (handles concurrent submissions)
  SELECT *
  INTO v_invitation
  FROM public.challenge_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  -- Both results are in → settle the battle
  IF v_invitation.challenger_result IS NOT NULL
    AND v_invitation.opponent_result IS NOT NULL
    AND v_invitation.status <> 'completed'
  THEN
    -- Determine winner (higher result wins; NULL = draw)
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
        updated_at = now()
    WHERE id = p_invitation_id;

    -- Award points to every participant who actually did something (result > 0).
    -- No arbitrary rep-count floor — the exercise counter itself validates quality.
    IF v_challenge.winner_points IS NOT NULL AND v_challenge.winner_points > 0 THEN
      IF v_invitation.challenger_result > 0 THEN
        UPDATE public.profiles
        SET points = COALESCE(points, 0) + v_challenge.winner_points
        WHERE id = v_invitation.challenger_id;
      END IF;

      IF v_invitation.opponent_result > 0 THEN
        UPDATE public.profiles
        SET points = COALESCE(points, 0) + v_challenge.winner_points
        WHERE id = v_invitation.opponent_id;
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT v_invitation.status, v_winner_id;
END;
$$;

-- Make sure only authenticated users can call this function
REVOKE EXECUTE ON FUNCTION public.submit_friendquest_battle_result(uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_friendquest_battle_result(uuid, integer) TO authenticated;
