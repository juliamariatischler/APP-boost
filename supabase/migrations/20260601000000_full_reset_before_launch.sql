-- ============================================================
-- VOLLSTÄNDIGER RESET aller Schülerdaten vor dem 01.06.2026
-- Bereinigt daily_results, point_awards, Punkte und Quest-Boni
-- für alle Schüler (nicht Lehrer/Admins) aller Klassen.
-- ============================================================

DO $$
DECLARE
  v_dr   int := 0;
  v_pa   int := 0;
  v_st   int := 0;
  v_pr   int := 0;
  v_cq   int := 0;
BEGIN

  -- 1. daily_results löschen (alle Schüler, vor 01.06.2026)
  DELETE FROM public.daily_results
  WHERE date < '2026-06-01'
    AND user_id IN (
      SELECT id FROM public.profiles
      WHERE COALESCE(role, 'student') = 'student'
    );
  GET DIAGNOSTICS v_dr = ROW_COUNT;
  RAISE NOTICE 'daily_results gelöscht: %', v_dr;

  -- 2. point_awards löschen (alle Schüler, vor 01.06.2026)
  DELETE FROM public.point_awards
  WHERE created_at < '2026-06-01 00:00:00+00'
    AND user_id IN (
      SELECT id FROM public.profiles
      WHERE COALESCE(role, 'student') = 'student'
    );
  GET DIAGNOSTICS v_pa = ROW_COUNT;
  RAISE NOTICE 'point_awards gelöscht: %', v_pa;

  -- 3. students.points auf 0
  UPDATE public.students
  SET points = 0
  WHERE deactivated_at IS NULL;
  GET DIAGNOSTICS v_st = ROW_COUNT;
  RAISE NOTICE 'students.points zurückgesetzt: %', v_st;

  -- 4. profiles.points auf 0 (nur Schüler)
  UPDATE public.profiles
  SET points = 0
  WHERE COALESCE(role, 'student') = 'student';
  GET DIAGNOSTICS v_pr = ROW_COUNT;
  RAISE NOTICE 'profiles.points zurückgesetzt: %', v_pr;

  -- 5. class_quest_bonus_awards löschen (vor 01.06.2026)
  DELETE FROM public.class_quest_bonus_awards
  WHERE month_start < '2026-06-01';
  GET DIAGNOSTICS v_cq = ROW_COUNT;
  RAISE NOTICE 'class_quest_bonus_awards gelöscht: %', v_cq;

  RAISE NOTICE '✓ Launch-Reset abgeschlossen. Alle Schüler starten sauber ab 01.06.2026.';
END;
$$;
