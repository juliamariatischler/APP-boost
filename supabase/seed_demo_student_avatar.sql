-- ============================================================
-- Avatar-Items für Demo-Schüler freischalten
-- Schüler: fb732085-b32e-4d73-83d3-0c43d1fb4d08
--
-- Logik: weeklyBlitze >= 40 → alle Items wählbar
-- Pro perfektem Tag: 5 Übungen × 1 + 20 Bonus = 25 Blitze
-- 5 Tage (Mo–Fr KW21) → 125 Blitze → alle Items freigeschaltet
--
-- Ausführen im Supabase SQL-Editor als Service-Role / postgres.
-- ============================================================

DO $$
DECLARE
  v_raw  uuid := 'fb732085-b32e-4d73-83d3-0c43d1fb4d08';
  v_uid  uuid;
  v_date date;
BEGIN
  -- Erst in students suchen (als students.id), dann als auth_user_id,
  -- sonst direkt als user_id verwenden (kann bereits auth.users.id sein)
  SELECT COALESCE(auth_user_id, id) INTO v_uid
  FROM public.students
  WHERE id = v_raw OR auth_user_id = v_raw
  LIMIT 1;

  -- Nicht in students gefunden → ID direkt als user_id nutzen
  IF v_uid IS NULL THEN
    v_uid := v_raw;
  END IF;

  RAISE NOTICE 'Demo-Schüler user_id: %', v_uid;

  -- Montag bis Freitag KW21/2026 (19.–23. Mai) mit vollem Tagesziel
  -- push_ups≥10, squats≥10, planks≥10, sit_ups≥25, jumping_jacks≥40, steps≥3000
  FOREACH v_date IN ARRAY ARRAY[
    '2026-05-19'::date,
    '2026-05-20'::date,
    '2026-05-21'::date,
    '2026-05-22'::date,
    '2026-05-23'::date
  ] LOOP
    INSERT INTO public.daily_results
      (user_id, date, push_ups, squats, planks, sit_ups, jumping_jacks, steps, updated_at)
    VALUES
      (v_uid, v_date, 15, 15, 30, 30, 50, 4200, now())
    ON CONFLICT (user_id, date) DO UPDATE SET
      push_ups      = GREATEST(public.daily_results.push_ups,      15),
      squats        = GREATEST(public.daily_results.squats,        15),
      planks        = GREATEST(public.daily_results.planks,        30),
      sit_ups       = GREATEST(public.daily_results.sit_ups,       30),
      jumping_jacks = GREATEST(public.daily_results.jumping_jacks, 50),
      steps         = GREATEST(public.daily_results.steps,         4200),
      updated_at    = now();
  END LOOP;

  RAISE NOTICE '✓ 5 Tage (Mo–Fr KW21) für Demo-Schüler eingetragen → 125 Blitze diese Woche.';
END;
$$;

-- Kontrolle: Blitze diese Woche
SELECT
  date,
  push_ups,
  squats,
  planks,
  sit_ups,
  jumping_jacks,
  steps,
  -- Blitze pro Tag (5 Übungen á 1 + 20 Bonus bei vollem Tagesziel)
  CASE WHEN push_ups >= 10 THEN 1 ELSE 0 END +
  CASE WHEN squats >= 10 THEN 1 ELSE 0 END +
  CASE WHEN planks >= 10 THEN 1 ELSE 0 END +
  CASE WHEN sit_ups >= 25 THEN 1 ELSE 0 END +
  CASE WHEN jumping_jacks >= 40 THEN 1 ELSE 0 END +
  CASE WHEN steps >= 3000
       AND push_ups >= 10 AND squats >= 10 AND planks >= 10
       AND sit_ups >= 25 AND jumping_jacks >= 40
       THEN 20 ELSE 0 END AS blitze_tag
FROM public.daily_results
WHERE user_id = COALESCE(
  (SELECT COALESCE(auth_user_id, id) FROM public.students
   WHERE id = 'fb732085-b32e-4d73-83d3-0c43d1fb4d08'
      OR auth_user_id = 'fb732085-b32e-4d73-83d3-0c43d1fb4d08'
   LIMIT 1),
  'fb732085-b32e-4d73-83d3-0c43d1fb4d08'
)
AND date BETWEEN '2026-05-19' AND '2026-05-25'
ORDER BY date;
