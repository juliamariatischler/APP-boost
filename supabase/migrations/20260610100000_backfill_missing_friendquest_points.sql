-- ============================================================
-- DIAGNOSE + GEZIELTER BACKFILL: Fehlende FriendQuest-Blitze
-- ============================================================
-- Hintergrund (01.06.2026 – heute):
--   Migration 20260529240000_friendquest_min_50_reps.sql enthielt zwei Bugs:
--   1. Spaltenname boost_points (existiert nicht) statt points
--      → Blitze wurden nach jedem Abschluss NIEMALS gebucht (kein Fehler sichtbar,
--        da UPDATE auf nicht-existente Spalte in plpgsql stillschweigend fehlschlägt)
--   2. Hartes >= 50 Minimum: Kniebeugen/Liegestütze (Ziel 30) bekamen ohnehin nichts
--
--   Relevante Periode: ab Launch-Reset 2026-06-01
--   Nicht betroffen: Tages-/Klassen-Challenge-Punkte (eigene Funktion, korrekter Spaltenname)
--
-- Idempotenz: Die Backfill-Buchungen erhalten source = 'fq_backfill_<invitation_id>'.
-- Ein zweites Ausführen ist sicher – INSERT passiert nur wenn noch kein Eintrag
-- mit diesem source für diesen user_id existiert.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- SCHRITT 1: DIAGNOSE (nur lesen, ändert nichts)
-- Zeigt: wer hat welche Battle abgeschlossen, wie viele Reps,
--        und wie viele Blitze fehlen.
-- Im Supabase SQL Editor ausführen → Ergebnis prüfen.
-- ══════════════════════════════════════════════════════════════

WITH participants AS (
  SELECT
    ci.id                             AS invitation_id,
    unnest(ARRAY[
      ci.challenger_id,
      ci.opponent_id
    ])                                AS user_id,
    unnest(ARRAY[
      ci.challenger_result,
      ci.opponent_result
    ])                                AS result,
    COALESCE(ci.completed_at, ci.updated_at)  AS completed_at,
    fc.name                           AS challenge_name,
    fc.winner_points                  AS points_due
  FROM public.challenge_invitations ci
  JOIN public.friend_challenges fc ON fc.id = ci.challenge_id
  WHERE ci.status = 'completed'
    AND COALESCE(ci.completed_at, ci.updated_at) >= '2026-06-01'
),
already_backfilled AS (
  -- Buchungen durch früheren Backfill-Lauf ODER durch die neue (korrekte) Funktion.
  -- Backfill: source = 'fq_backfill_<invitation_id>'  → invitation_id = letzten 36 Zeichen
  -- Neue Funktion: source = 'friendquest_battle', kein Invitation-Bezug im source.
  -- Wir nutzen beide, um Doppelbuchungen in jedem Fall zu verhindern.
  SELECT
    user_id,
    RIGHT(source, 36) AS invitation_id,
    SUM(points)       AS points_booked
  FROM public.point_awards
  WHERE source LIKE 'fq_backfill_%'
  GROUP BY user_id, source
)
SELECT
  pr.username,
  p.challenge_name,
  p.result                                      AS reps_achieved,
  p.points_due                                  AS blitze_sollte_erhalten,
  COALESCE(ab.points_booked, 0)                 AS bereits_gebucht,
  p.points_due - COALESCE(ab.points_booked, 0) AS noch_fehlend,
  (p.completed_at AT TIME ZONE 'Europe/Vienna')::date AS datum,
  p.invitation_id
FROM participants p
JOIN public.profiles pr ON pr.id = p.user_id
LEFT JOIN already_backfilled ab
  ON ab.user_id = p.user_id
  AND ab.invitation_id = p.invitation_id::text
WHERE p.result > 0                                          -- hat wirklich teilgenommen
  AND p.points_due > 0
  AND p.points_due > COALESCE(ab.points_booked, 0)         -- noch nicht vollständig gebucht
ORDER BY p.completed_at DESC, pr.username;


-- ══════════════════════════════════════════════════════════════
-- SCHRITT 2: BACKFILL
-- Erst Schritt 1 prüfen und Ergebnis bestätigen!
-- Dann die /* … */ Kommentare entfernen und ausführen.
--
-- Sicherheiten:
--   – Nur Teilnehmer mit result > 0
--   – Nur wenn für diese invitation_id noch kein Backfill-Eintrag existiert
--   – Kein Update von Profilen die nicht gefunden werden (WHERE id = ...)
--   – Gibt am Ende eine Zusammenfassung aus (RAISE NOTICE im Message-Tab)
-- ══════════════════════════════════════════════════════════════

/*
DO $$
DECLARE
  v_row            RECORD;
  v_source_key     TEXT;
  v_already_exists BOOLEAN;
  v_total_bookings INT := 0;
  v_total_points   INT := 0;
BEGIN

  FOR v_row IN
    SELECT
      unnest(ARRAY[ci.challenger_id,   ci.opponent_id  ]) AS user_id,
      unnest(ARRAY[ci.challenger_result, ci.opponent_result]) AS result,
      ci.id        AS invitation_id,
      fc.winner_points AS points_due
    FROM public.challenge_invitations ci
    JOIN public.friend_challenges fc ON fc.id = ci.challenge_id
    WHERE ci.status = 'completed'
      AND COALESCE(ci.completed_at, ci.updated_at) >= '2026-06-01'
      AND fc.winner_points > 0
  LOOP
    -- Nur wer wirklich teilgenommen hat
    CONTINUE WHEN v_row.result IS NULL OR v_row.result <= 0;

    -- Eindeutiger Buchungsschlüssel pro Person + Battle
    v_source_key := 'fq_backfill_' || v_row.invitation_id::text;

    -- Idempotenz: bereits gebucht?
    SELECT EXISTS (
      SELECT 1 FROM public.point_awards
      WHERE user_id = v_row.user_id
        AND source   = v_source_key
    ) INTO v_already_exists;

    CONTINUE WHEN v_already_exists;

    -- Punkte auf profiles.points addieren
    UPDATE public.profiles
    SET    points = COALESCE(points, 0) + v_row.points_due
    WHERE  id = v_row.user_id;

    -- Buchung als Belege eintragen (kein metadata-Feld nötig, source ist eindeutig)
    INSERT INTO public.point_awards (user_id, points, source)
    VALUES (v_row.user_id, v_row.points_due, v_source_key);

    v_total_bookings := v_total_bookings + 1;
    v_total_points   := v_total_points   + v_row.points_due;

    RAISE NOTICE 'Backfill: % +% Blitze (invitation=%)',
      v_row.user_id, v_row.points_due, v_row.invitation_id;
  END LOOP;

  RAISE NOTICE '✓ Fertig: % Buchungen, % Blitze gesamt.', v_total_bookings, v_total_points;
END;
$$;
*/
