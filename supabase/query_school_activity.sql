-- ────────────────────────────────────────────────────────────────────────────
-- Schulen-Aktivitätsübersicht: Übungen + Tagespunkte pro Schüler
-- Schülertypen:
--   A) QR/Code-Login → public.students → classes → schools
--   B) Auth-Login    → public.profiles → schools (über school_id FK)
-- ────────────────────────────────────────────────────────────────────────────

-- Punkteformel (pro Tag):
--   push_ups       >= 10  → +1 Pkt
--   squats         >= 10  → +1 Pkt
--   planks         >= 10  → +1 Pkt
--   sit_ups        >= 25  → +1 Pkt
--   jumping_jacks  >= 40  → +1 Pkt
--   ALLE 5 + steps >= 3000 → +20 Bonus-Pkt (Tagesziel komplett)
-- ────────────────────────────────────────────────────────────────────────────

SELECT
    dr.date,
    sub.schule,
    sub.klasse,
    sub.student_id,
    sub.anzeigename,
    COALESCE(dr.push_ups,       0) AS liegestuetze,
    COALESCE(dr.squats,         0) AS kniebeugen,
    COALESCE(dr.planks,         0) AS planks,
    COALESCE(dr.sit_ups,        0) AS sit_ups,
    COALESCE(dr.jumping_jacks,  0) AS jumping_jacks,
    COALESCE(dr.steps,          0) AS schritte,

    -- Tagespunkte berechnen
    (
      CASE WHEN COALESCE(dr.push_ups,      0) >= 10 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(dr.squats,        0) >= 10 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(dr.planks,        0) >= 10 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(dr.sit_ups,       0) >= 25 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(dr.jumping_jacks, 0) >= 40 THEN 1 ELSE 0 END +
      CASE
        WHEN COALESCE(dr.push_ups,      0) >= 10
         AND COALESCE(dr.squats,        0) >= 10
         AND COALESCE(dr.planks,        0) >= 10
         AND COALESCE(dr.sit_ups,       0) >= 25
         AND COALESCE(dr.jumping_jacks, 0) >= 40
         AND COALESCE(dr.steps,         0) >= 3000
        THEN 20 ELSE 0
      END
    ) AS punkte_heute

FROM public.daily_results dr
JOIN (

    -- A) QR/Code-Login Schüler
    SELECT
        st.id    AS student_id,
        st.display_name AS anzeigename,
        sc.name  AS schule,
        cl.name  AS klasse
    FROM public.students st
    JOIN public.classes cl ON cl.id = st.class_id
    JOIN public.schools sc ON sc.id = cl.school_id

    UNION ALL

    -- B) Auth-Login Schüler (school_id FK gesetzt)
    SELECT
        p.id     AS student_id,
        p.username AS anzeigename,
        sc.name  AS schule,
        COALESCE(cl.name, p.class) AS klasse
    FROM public.profiles p
    JOIN public.schools sc ON sc.id = p.school_id
    LEFT JOIN public.classes cl ON cl.id = p.class_id
    WHERE p.role = 'student'

    UNION ALL

    -- C) Auth-Login Schüler (nur school-Text-Feld, noch kein school_id FK)
    SELECT
        p.id     AS student_id,
        p.username AS anzeigename,
        p.school AS schule,
        p.class  AS klasse
    FROM public.profiles p
    WHERE p.role = 'student'
      AND p.school_id IS NULL

) sub ON sub.student_id = dr.user_id

-- Nur Tage mit mindestens einer Aktivität
WHERE (
    COALESCE(dr.push_ups,      0) > 0 OR
    COALESCE(dr.squats,        0) > 0 OR
    COALESCE(dr.planks,        0) > 0 OR
    COALESCE(dr.sit_ups,       0) > 0 OR
    COALESCE(dr.jumping_jacks, 0) > 0 OR
    COALESCE(dr.steps,         0) > 0
)

ORDER BY
    sub.schule,
    sub.klasse,
    sub.anzeigename,
    dr.date DESC;
