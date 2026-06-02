-- Diagnose: Was steckt wirklich in daily_results?

-- 1) Datentyp der date-Spalte prüfen
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'daily_results'
  AND column_name  IN ('date', 'user_id');

-- 2) Alle User mit Einträgen Ende Mai (rohe Werte, kein Cast)
SELECT user_id, date, push_ups, squats, planks, sit_ups, jumping_jacks, steps
FROM public.daily_results
WHERE date::text >= '2026-05-28'
  AND date::text <= '2026-05-31'
LIMIT 30;

-- 3) Neueste 5 Einträge egal welcher User (Format prüfen)
SELECT user_id, date, push_ups, squats
FROM public.daily_results
ORDER BY date DESC
LIMIT 5;
