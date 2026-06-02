-- Update submit_friendquest_battle_result to write point_awards entries
-- using source = 'fq_backfill_<invitation_id>' so the backfill script
-- can detect already-awarded battles and never double-books.

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
  v_user_id    uuid := auth.uid();
  v_invitation public.challenge_invitations%ROWTYPE;
  v_challenge  public.friend_challenges%ROWTYPE;
  v_winner_id  uuid;
  v_source_key text;
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
    AND status IN ('accepted', 'in_progress')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not available';
  END IF;

  IF v_invitation.challenger_id = v_user_id THEN
    IF v_invitation.challenger_result IS NOT NULL THEN
      RAISE EXCEPTION 'Result already submitted';
    END IF;
    UPDATE public.challenge_invitations
    SET challenger_result = p_result, status = 'in_progress', updated_at = now()
    WHERE id = p_invitation_id;
  ELSE
    IF v_invitation.opponent_result IS NOT NULL THEN
      RAISE EXCEPTION 'Result already submitted';
    END IF;
    UPDATE public.challenge_invitations
    SET opponent_result = p_result, status = 'in_progress', updated_at = now()
    WHERE id = p_invitation_id;
  END IF;

  SELECT * INTO v_invitation
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

    SELECT * INTO v_challenge
    FROM public.friend_challenges
    WHERE id = v_invitation.challenge_id;

    UPDATE public.challenge_invitations
    SET status = 'completed', winner_id = v_winner_id, updated_at = now()
    WHERE id = p_invitation_id;

    -- source key shared with backfill for idempotent double-booking protection
    v_source_key := 'fq_backfill_' || p_invitation_id::text;

    IF v_challenge.winner_points IS NOT NULL AND v_challenge.winner_points > 0 THEN
      IF v_invitation.challenger_result > 0 THEN
        UPDATE public.profiles
        SET points = COALESCE(points, 0) + v_challenge.winner_points
        WHERE id = v_invitation.challenger_id;

        INSERT INTO public.point_awards (user_id, points, source)
        SELECT v_invitation.challenger_id, v_challenge.winner_points, v_source_key
        WHERE NOT EXISTS (
          SELECT 1 FROM public.point_awards
          WHERE user_id = v_invitation.challenger_id AND source = v_source_key
        );
      END IF;

      IF v_invitation.opponent_result > 0 THEN
        UPDATE public.profiles
        SET points = COALESCE(points, 0) + v_challenge.winner_points
        WHERE id = v_invitation.opponent_id;

        INSERT INTO public.point_awards (user_id, points, source)
        SELECT v_invitation.opponent_id, v_challenge.winner_points, v_source_key
        WHERE NOT EXISTS (
          SELECT 1 FROM public.point_awards
          WHERE user_id = v_invitation.opponent_id AND source = v_source_key
        );
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_invitation.status, v_winner_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_friendquest_battle_result(uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_friendquest_battle_result(uuid, integer) TO authenticated;
