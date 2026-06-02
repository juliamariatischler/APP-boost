-- ============================================================
-- IMPORT: Planks täglich 27.05.–31.05.2026
-- Benutzer: 1f760475-4ce8-4ab8-accd-947e9dcb434b
-- ============================================================
-- Fügt fehlende daily_results für Planks ein.
-- Bei bereits vorhandenem Eintrag wird planks nur erhöht,
-- wenn der neue Wert größer ist (kein Überschreiben).
-- Mindest-Schwellwert für 1 Blitz: planks >= 10
-- ============================================================

-- ── SCHRITT 1: DIAGNOSE – aktueller Stand ───────────────────
SELECT
  date,
  planks,
  CASE WHEN planks >= 10 THEN '✓ zählt' ELSE '✗ unter 10' END AS status
FROM public.daily_results
WHERE user_id = '1f760475-4ce8-4ab8-accd-947e9dcb434b'
  AND date BETWEEN '2026-05-27' AND '2026-05-31'
ORDER BY date;


-- ── SCHRITT 2: IMPORT ────────────────────────────────────────
-- Standardwert: 10 Planks pro Tag (= Mindestschwelle für 1 Blitz).
-- Wert anpassen falls tatsächliche Reps bekannt sind.

INSERT INTO public.daily_results (user_id, date, planks)
VALUES
  ('1f760475-4ce8-4ab8-accd-947e9dcb434b', '2026-05-27', 10),
  ('1f760475-4ce8-4ab8-accd-947e9dcb434b', '2026-05-28', 10),
  ('1f760475-4ce8-4ab8-accd-947e9dcb434b', '2026-05-29', 10),
  ('1f760475-4ce8-4ab8-accd-947e9dcb434b', '2026-05-30', 10),
  ('1f760475-4ce8-4ab8-accd-947e9dcb434b', '2026-05-31', 10)
ON CONFLICT (user_id, date) DO UPDATE
  SET planks    = GREATEST(public.daily_results.planks, EXCLUDED.planks),
      updated_at = now()
WHERE EXCLUDED.planks > public.daily_results.planks;


-- ── SCHRITT 3: KONTROLLE ─────────────────────────────────────
SELECT
  date,
  planks,
  CASE WHEN planks >= 10 THEN '✓ zählt' ELSE '✗ unter 10' END AS status
FROM public.daily_results
WHERE user_id = '1f760475-4ce8-4ab8-accd-947e9dcb434b'
  AND date BETWEEN '2026-05-27' AND '2026-05-31'
ORDER BY date;
