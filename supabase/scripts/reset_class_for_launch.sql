-- ============================================================
-- KLASSEN-RESET vor dem offiziellen Start (01.06.2026)
-- Klasse: 1651d5b5-bc63-47c5-b70e-a25a7b73c259
--
-- Löscht alle Aktivitätsdaten bis inkl. 31.05.2026 und
-- setzt Punkte für alle Schüler der Klasse auf 0.
-- Ausführen im Supabase SQL-Editor als Service-Role / postgres.
-- ============================================================

DO $$
DECLARE
  v_class_id  uuid    := '1651d5b5-bc63-47c5-b70e-a25a7b73c259';
  v_uid       uuid;
  v_class_name text;
  v_school_name text;
  v_uid_list  uuid[];
  v_total_dr  int := 0;
  v_total_pa  int := 0;
  v_deleted   int := 0;
  r           RECORD;
BEGIN

  -- Klassennamen und Schule für class_quest_bonus_awards ermitteln
  SELECT c.name, sch.name
  INTO v_class_name, v_school_name
  FROM public.classes c
  JOIN public.schools sch ON sch.id = c.school_id
  WHERE c.id = v_class_id;

  RAISE NOTICE 'Klasse: % | Schule: %', v_class_name, v_school_name;

  -- Liste aller user_ids (auth_user_id oder student.id) für die Klasse
  SELECT ARRAY_AGG(COALESCE(s.auth_user_id, s.id))
  INTO v_uid_list
  FROM public.students s
  WHERE s.class_id = v_class_id;

  RAISE NOTICE 'Schüler gefunden: %', ARRAY_LENGTH(v_uid_list, 1);

  -- ── 1. daily_results löschen (bis inkl. 31.05.2026) ───────
  DELETE FROM public.daily_results
  WHERE user_id = ANY(v_uid_list)
    AND date <= '2026-05-31';

  GET DIAGNOSTICS v_total_dr = ROW_COUNT;
  RAISE NOTICE 'daily_results gelöscht: %', v_total_dr;

  -- ── 2. point_awards löschen (bis inkl. 31.05.2026) ────────
  DELETE FROM public.point_awards
  WHERE user_id = ANY(v_uid_list)
    AND created_at < '2026-06-01 00:00:00+00';

  GET DIAGNOSTICS v_total_pa = ROW_COUNT;
  RAISE NOTICE 'point_awards gelöscht: %', v_total_pa;

  -- ── 3. Punkte auf 0 zurücksetzen ──────────────────────────
  UPDATE public.students
  SET points = 0
  WHERE class_id = v_class_id;

  UPDATE public.profiles
  SET points = 0
  WHERE id = ANY(v_uid_list);

  RAISE NOTICE 'Punkte (students + profiles) auf 0 zurückgesetzt';

  -- ── 4. class_quest_bonus_awards löschen ───────────────────
  DELETE FROM public.class_quest_bonus_awards
  WHERE class = v_class_name
    AND school = v_school_name
    AND month_start < '2026-06-01';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'class_quest_bonus_awards gelöscht: %', v_deleted;

  RAISE NOTICE '✓ Reset abgeschlossen. Klasse startet sauber ab 01.06.2026.';
END;
$$;

-- ── Diagnose: Ergebnis nach dem Reset ─────────────────────────
SELECT
  s.first_name,
  s.last_name,
  s.points                                              AS punkte,
  COUNT(dr.date) FILTER (WHERE dr.date <= '2026-05-31') AS tage_mai_verblieben,
  COUNT(dr.date) FILTER (WHERE dr.date >= '2026-06-01') AS tage_ab_juni,
  COUNT(dr.date)                                        AS tage_gesamt
FROM public.students s
LEFT JOIN public.daily_results dr
  ON dr.user_id = COALESCE(s.auth_user_id, s.id)
WHERE s.class_id = '1651d5b5-bc63-47c5-b70e-a25a7b73c259'
GROUP BY s.id, s.first_name, s.last_name, s.points
ORDER BY s.last_name, s.first_name;
