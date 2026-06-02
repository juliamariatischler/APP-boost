-- ════════════════════════════════════════════════════════════════════════════
-- BG PESTALOZZI – Anmeldungen + heutige Punkte pro Übung
-- ════════════════════════════════════════════════════════════════════════════
-- Schülertypen (siehe query_school_activity.sql):
--   A) QR/Code-Login → public.students → classes → schools
--   B) Auth-Login    → public.profiles (school_id FK) → schools
--   C) Auth-Login    → public.profiles (nur school-Textfeld, kein FK)
--
-- Punkteformel (pro Tag):
--   push_ups      >= 10  → +1 Pkt
--   squats        >= 10  → +1 Pkt
--   planks        >= 10  → +1 Pkt
--   sit_ups       >= 25  → +1 Pkt
--   jumping_jacks >= 40  → +1 Pkt
--   ALLE 5 + steps >= 3000 → +20 Bonus-Pkt (Tagesziel komplett)
-- ════════════════════════════════════════════════════════════════════════════


-- ── Alle Pestalozzi-Schüler (einheitliche Basis für beide Abfragen) ──────────
WITH pestalozzi_students AS (
    -- A) QR/Code-Login Schüler
    SELECT st.id AS student_id, st.display_name AS anzeigename,
           sc.name AS schule, cl.name AS klasse
    FROM public.students st
    JOIN public.classes cl ON cl.id = st.class_id
    JOIN public.schools  sc ON sc.id = cl.school_id
    WHERE sc.name ILIKE '%pestalozzi%'

    UNION ALL

    -- B) Auth-Login Schüler (school_id FK gesetzt)
    SELECT p.id, p.username, sc.name, COALESCE(cl.name, p.class)
    FROM public.profiles p
    JOIN public.schools  sc ON sc.id = p.school_id
    LEFT JOIN public.classes cl ON cl.id = p.class_id
    WHERE p.role = 'student' AND sc.name ILIKE '%pestalozzi%'

    UNION ALL

    -- C) Auth-Login Schüler (nur school-Textfeld, kein FK)
    SELECT p.id, p.username, p.school, p.class
    FROM public.profiles p
    WHERE p.role = 'student'
      AND p.school_id IS NULL
      AND p.school ILIKE '%pestalozzi%'
)

-- ── ABFRAGE 1: Anzahl angemeldeter Schüler (gesamt + pro Klasse) ─────────────
SELECT
    'GESAMT' AS klasse,
    COUNT(*) AS angemeldete_schueler
FROM pestalozzi_students
UNION ALL
SELECT
    klasse,
    COUNT(*)
FROM pestalozzi_students
GROUP BY klasse
ORDER BY klasse;


-- ════════════════════════════════════════════════════════════════════════════
-- ── ABFRAGE 2: Wer hat HEUTE wieviele Punkte durch welche Übung gesammelt? ───
-- ════════════════════════════════════════════════════════════════════════════
WITH pestalozzi_students AS (
    SELECT st.id AS student_id, st.display_name AS anzeigename,
           sc.name AS schule, cl.name AS klasse
    FROM public.students st
    JOIN public.classes cl ON cl.id = st.class_id
    JOIN public.schools  sc ON sc.id = cl.school_id
    WHERE sc.name ILIKE '%pestalozzi%'
    UNION ALL
    SELECT p.id, p.username, sc.name, COALESCE(cl.name, p.class)
    FROM public.profiles p
    JOIN public.schools  sc ON sc.id = p.school_id
    LEFT JOIN public.classes cl ON cl.id = p.class_id
    WHERE p.role = 'student' AND sc.name ILIKE '%pestalozzi%'
    UNION ALL
    SELECT p.id, p.username, p.school, p.class
    FROM public.profiles p
    WHERE p.role = 'student'
      AND p.school_id IS NULL
      AND p.school ILIKE '%pestalozzi%'
)
SELECT
    s.klasse,
    s.anzeigename,

    -- Rohwerte je Übung
    COALESCE(dr.push_ups,      0) AS liegestuetze,
    COALESCE(dr.squats,        0) AS kniebeugen,
    COALESCE(dr.planks,        0) AS planks,
    COALESCE(dr.sit_ups,       0) AS sit_ups,
    COALESCE(dr.jumping_jacks, 0) AS jumping_jacks,
    COALESCE(dr.steps,         0) AS schritte,

    -- Punkt pro Übung (1 = Schwelle erreicht)
    CASE WHEN COALESCE(dr.push_ups,      0) >= 10 THEN 1 ELSE 0 END AS pkt_liegestuetze,
    CASE WHEN COALESCE(dr.squats,        0) >= 10 THEN 1 ELSE 0 END AS pkt_kniebeugen,
    CASE WHEN COALESCE(dr.planks,        0) >= 10 THEN 1 ELSE 0 END AS pkt_planks,
    CASE WHEN COALESCE(dr.sit_ups,       0) >= 25 THEN 1 ELSE 0 END AS pkt_sit_ups,
    CASE WHEN COALESCE(dr.jumping_jacks, 0) >= 40 THEN 1 ELSE 0 END AS pkt_jumping_jacks,
    CASE
      WHEN COALESCE(dr.push_ups, 0) >= 10 AND COALESCE(dr.squats, 0) >= 10
       AND COALESCE(dr.planks, 0) >= 10 AND COALESCE(dr.sit_ups, 0) >= 25
       AND COALESCE(dr.jumping_jacks, 0) >= 40 AND COALESCE(dr.steps, 0) >= 3000
      THEN 20 ELSE 0
    END AS bonus_tagesziel,

    -- Gesamtpunkte heute
    (
      CASE WHEN COALESCE(dr.push_ups,      0) >= 10 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(dr.squats,        0) >= 10 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(dr.planks,        0) >= 10 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(dr.sit_ups,       0) >= 25 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(dr.jumping_jacks, 0) >= 40 THEN 1 ELSE 0 END +
      CASE
        WHEN COALESCE(dr.push_ups, 0) >= 10 AND COALESCE(dr.squats, 0) >= 10
         AND COALESCE(dr.planks, 0) >= 10 AND COALESCE(dr.sit_ups, 0) >= 25
         AND COALESCE(dr.jumping_jacks, 0) >= 40 AND COALESCE(dr.steps, 0) >= 3000
        THEN 20 ELSE 0
      END
    ) AS punkte_heute

FROM pestalozzi_students s
JOIN public.daily_results dr
  ON dr.user_id = s.student_id
 AND dr.date = CURRENT_DATE
-- Nur Schüler mit mindestens einer Aktivität heute
WHERE (
    COALESCE(dr.push_ups,      0) > 0 OR
    COALESCE(dr.squats,        0) > 0 OR
    COALESCE(dr.planks,        0) > 0 OR
    COALESCE(dr.sit_ups,       0) > 0 OR
    COALESCE(dr.jumping_jacks, 0) > 0 OR
    COALESCE(dr.steps,         0) > 0
)
ORDER BY punkte_heute DESC, s.klasse, s.anzeigename;
