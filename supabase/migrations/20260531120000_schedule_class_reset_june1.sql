-- Aktiviert pg_cron und plant den Klassen-Reset für 01.06.2026 00:00 CEST (= 31.05. 22:00 UTC)

-- Extension aktivieren (falls noch nicht aktiv)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cleanup-Funktion erstellen
CREATE OR REPLACE FUNCTION public.reset_class_for_launch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id    uuid := '1651d5b5-bc63-47c5-b70e-a25a7b73c259';
  v_class_name  text;
  v_school_name text;
  v_uid_list    uuid[];
BEGIN
  SELECT c.name, sch.name
  INTO v_class_name, v_school_name
  FROM public.classes c
  JOIN public.schools sch ON sch.id = c.school_id
  WHERE c.id = v_class_id;

  SELECT ARRAY_AGG(COALESCE(s.auth_user_id, s.id))
  INTO v_uid_list
  FROM public.students s
  WHERE s.class_id = v_class_id;

  DELETE FROM public.daily_results
  WHERE user_id = ANY(v_uid_list)
    AND date <= '2026-05-31';

  DELETE FROM public.point_awards
  WHERE user_id = ANY(v_uid_list)
    AND created_at < '2026-06-01 00:00:00+00';

  UPDATE public.students SET points = 0 WHERE class_id = v_class_id;
  UPDATE public.profiles  SET points = 0 WHERE id = ANY(v_uid_list);

  DELETE FROM public.class_quest_bonus_awards
  WHERE class  = v_class_name
    AND school = v_school_name
    AND month_start < '2026-06-01';

  RAISE LOG 'reset_class_for_launch: Klasse % erfolgreich zurückgesetzt', v_class_name;

  -- Einmalig: Job nach Ausführung selbst löschen
  PERFORM cron.unschedule('reset-class-1651d5b5-june1');
END;
$$;

-- Cron-Job einplanen: 31. Mai 22:00 UTC = 01. Juni 00:00 CEST
SELECT cron.schedule(
  'reset-class-1651d5b5-june1',
  '0 22 31 5 *',
  'SELECT public.reset_class_for_launch()'
);
