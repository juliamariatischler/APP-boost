-- ============================================================
-- DIAGNOSE + GEZIELTER BACKFILL: Fehlende FriendQuest-Blitze
-- ============================================================
-- Kontext:
--   - 01.06.2026: vollständiger Launch-Reset → alle Schülerpunkte auf 0
--   - Seit 01.06. aktiver Bug in submit_friendquest_battle_result:
--     Spaltenname boost_points (existiert nicht) statt points
--     → Blitze wurden nach jedem FriendQuest-Abschluss NIEMALS gebucht
--   - Betroffene Challenges: alle (falsche Spalte), speziell push-ups/squats
--     bei denen das 50-Reps-Minimum ohnehin nicht erreicht werden konnte (Ziel=30)
--
-- Relevante Periode: 2026-06-01 bis heute (Reset-Zeitpunkt bis Bugfix)
-- ============================================================

-- ── SCHRITT 1: DIAGNOSE – was fehlt? ────────────────────────
-- Kopiere diesen Block in den Supabase SQL Editor und führe ihn aus.
-- Er ändert NICHTS, zeigt aber genau wer welche Punkte nicht bekommen hat.

WITH battle_participants AS (
  SELECT
    ci.id                           AS invitation_id,
    unnest(ARRAY[ci.challenger_id, ci.opponent_id])     AS user_id,
    unnest(ARRAY[ci.challenger_result, ci.opponent_result]) AS result,
    ci.updated_at                   AS completed_at,
    fc.name                         AS challenge_name,
    fc.winner_points                AS points_due
  FROM public.challenge_invitations ci
  JOIN public.friend_challenges fc ON fc.id = ci.challenge_id
  WHERE ci.status = 'completed'
    AND ci.updated_at >= '2026-06-01'   -- nach Launch-Reset
),
eligible AS (
  -- Nur wer wirklich teilgenommen hat (result > 0) und Punkte verdient hat
  SELECT *
  FROM battle_participants
  WHERE result > 0
    AND points_due > 0
),
awarded AS (
  -- Punkte die tatsächlich als FriendQuest gebucht wurden
  SELECT user_id, SUM(points) AS already_awarded
  FROM public.point_awards
  WHERE source = 'friendquest_battle'
    AND created_at >= '2026-06-01'
  GROUP BY user_id
)
SELECT
  pr.username,
  e.challenge_name,
  e.result         AS reps_achieved,
  e.points_due     AS blitze_sollte_erhalten,
  COALESCE(a.already_awarded, 0) AS blitze_tatsaechlich_erhalten,
  e.points_due - COALESCE(a.already_awarded, 0) AS fehlende_blitze,
  e.completed_at::timestamptz AT TIME ZONE 'Europe/Vienna' AS wann,
  e.invitation_id
FROM eligible e
JOIN public.profiles pr ON pr.id = e.user_id
LEFT JOIN awarded a ON a.user_id = e.user_id
WHERE e.points_due > COALESCE(a.already_awarded, 0)  -- nur wirklich Fehlende
ORDER BY e.completed_at DESC, pr.username;


-- ── SCHRITT 2: BACKFILL ──────────────────────────────────────
-- Erst Schritt 1 prüfen! Dann die Kommentare unten entfernen und ausführen.
-- Der Backfill bucht exakt die Differenz aus Schritt 1 – keine Doppelbuchung möglich,
-- weil er zuvor gebuchte FriendQuest-Punkte berücksichtigt.

/*
DO $$
DECLARE
  v_row            RECORD;
  v_already        INTEGER;
  v_to_add         INTEGER;
  v_total_bookings INTEGER := 0;
  v_total_points   INTEGER := 0;
BEGIN

  FOR v_row IN
    WITH battle_participants AS (
      SELECT
        ci.id   AS invitation_id,
        unnest(ARRAY[ci.challenger_id, ci.opponent_id])       AS user_id,
        unnest(ARRAY[ci.challenger_result, ci.opponent_result]) AS result,
        fc.winner_points AS points_due
      FROM public.challenge_invitations ci
      JOIN public.friend_challenges fc ON fc.id = ci.challenge_id
      WHERE ci.status = 'completed'
        AND ci.updated_at >= '2026-06-01'
    )
    SELECT user_id, invitation_id, result, points_due
    FROM battle_participants
    WHERE result > 0 AND points_due > 0
  LOOP

    -- Prüfe ob für diese Invitation schon FriendQuest-Punkte gebucht wurden
    SELECT COALESCE(SUM(points), 0)
    INTO v_already
    FROM public.point_awards
    WHERE user_id = v_row.user_id
      AND source = 'friendquest_battle'
      AND metadata->>'invitation_id' = v_row.invitation_id::text;

    v_to_add := GREATEST(0, v_row.points_due - v_already);

    IF v_to_add > 0 THEN
      -- Punkte auf Profil addieren
      UPDATE public.profiles
      SET points = COALESCE(points, 0) + v_to_add
      WHERE id = v_row.user_id;

      -- Buchung in point_awards für Transparenz und Idempotenz
      INSERT INTO public.point_awards (user_id, points, source, metadata)
      VALUES (
        v_row.user_id,
        v_to_add,
        'friendquest_battle',
        jsonb_build_object('invitation_id', v_row.invitation_id, 'backfill', true)
      );

      v_total_bookings := v_total_bookings + 1;
      v_total_points   := v_total_points + v_to_add;

      RAISE NOTICE 'Backfill: user=% invitation=% +% Blitze', v_row.user_id, v_row.invitation_id, v_to_add;
    END IF;
  END LOOP;

  RAISE NOTICE '✓ Backfill fertig: % Buchungen, % Blitze total vergeben.', v_total_bookings, v_total_points;
END;
$$;
*/
