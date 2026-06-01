-- ============================================================
-- Korrektur: Punkte aus verbliebenen echten daily_results neu berechnen
-- (nach dem Demo-Cleanup der Mai 17–24 Daten)
-- Ausführen im Supabase SQL-Editor als Service-Role / postgres.
-- ============================================================

DO $$
DECLARE
  v_uid    uuid;
  v_sid    uuid;
  v_pts    int;
  v_sids uuid[] := ARRAY[
    '4231ee53-0651-459b-a3a7-de0c2379a676'::uuid,
    '51352c08-97c6-48ef-b95f-e8bae18f487f'::uuid,
    '984c134d-1a18-4b8f-959e-8a5a204727ad'::uuid,
    'b51b621c-ca8a-4fb9-98b8-e20e75c84062'::uuid,
    'ce169700-ff10-44da-a78a-0fe26737917c'::uuid,
    'f6ce343a-3a6b-44f6-bf85-5321547a18af'::uuid,
    '24d01d2e-a693-4a77-9cfd-018db0c491f8'::uuid,
    '58123d10-9802-4e3b-93fe-1fe668b280ee'::uuid,
    '72678301-448a-49d2-a282-c5fd72fd4b67'::uuid,
    'b3af1781-6a8e-44b0-8a87-bb623288ea24'::uuid,
    'c8be3afb-14e8-4f1a-9e62-3b25831c475f'::uuid,
    'e415df48-7eab-4976-a460-e06fa21c8ad8'::uuid,
    '5699e408-208e-49d3-9d23-24ed4f4cfaff'::uuid,
    '6c4a143d-229e-4e04-9695-b3cc00214d92'::uuid,
    'b0713941-f6ef-48e7-9ed3-71f416372078'::uuid,
    'b9f85fe2-2192-4120-b8f9-96f03697fb0e'::uuid,
    'e0733fca-95a2-4255-aa50-aa43534afbed'::uuid,
    'f6ceef0f-ca9a-45a6-9795-dbffdf57ee87'::uuid
  ];
BEGIN
  FOREACH v_sid IN ARRAY v_sids LOOP
    SELECT COALESCE(auth_user_id, id) INTO v_uid
    FROM public.students WHERE id = v_sid;

    CONTINUE WHEN v_uid IS NULL;

    -- Punkte aus echten daily_results neu berechnen
    -- (gleiche Logik wie die App: pro Tag 1 Punkt pro Übung die > 0 ist + Schritte-Bonus)
    SELECT COALESCE(SUM(
      (CASE WHEN push_ups      > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN squats        > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN planks        > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN sit_ups       > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN jumping_jacks > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN steps >= 5000 THEN 1 ELSE 0 END)
    ), 0)
    INTO v_pts
    FROM public.daily_results
    WHERE user_id = v_uid;

    UPDATE public.students SET points = v_pts WHERE id = v_sid;
    UPDATE public.profiles  SET points = v_pts WHERE id = v_uid;

    RAISE NOTICE 'student % (uid=%): Punkte neu = %', v_sid, v_uid, v_pts;
  END LOOP;
END;
$$;

-- Diagnose mit Datumsaufteilung
SELECT
  s.first_name,
  s.id                                           AS student_id,
  s.points                                       AS punkte_neu,
  COUNT(dr.date) FILTER (WHERE dr.date < '2026-05-31') AS tage_vor_31mai,
  COUNT(dr.date) FILTER (WHERE dr.date >= '2026-05-31') AS tage_ab_31mai,
  COUNT(dr.date)                                 AS tage_gesamt
FROM public.students s
LEFT JOIN public.daily_results dr
  ON dr.user_id = COALESCE(s.auth_user_id, s.id)
WHERE s.class_id = '1651d5b5-bc63-47c5-b70e-a25a7b73c259'
GROUP BY s.id, s.first_name, s.points
ORDER BY s.first_name;
