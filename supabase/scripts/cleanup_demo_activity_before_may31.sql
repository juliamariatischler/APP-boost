-- ============================================================
-- Löscht Demo-Aktivitätsdaten vor dem 31.05.2026
-- für Klasse 1651d5b5-bc63-47c5-b70e-a25a7b73c259
-- Ausführen im Supabase SQL-Editor als Service-Role / postgres.
-- ============================================================

DO $$
DECLARE
  v_uid  uuid;
  v_sid  uuid;
  v_sids uuid[] := ARRAY[
    '4231ee53-0651-459b-a3a7-de0c2379a676'::uuid,  -- Johannes
    '51352c08-97c6-48ef-b95f-e8bae18f487f'::uuid,  -- Julia Tischler
    '984c134d-1a18-4b8f-959e-8a5a204727ad'::uuid,  -- Julia
    'b51b621c-ca8a-4fb9-98b8-e20e75c84062'::uuid,  -- Rafaela
    'ce169700-ff10-44da-a78a-0fe26737917c'::uuid,  -- Marie
    'f6ce343a-3a6b-44f6-bf85-5321547a18af'::uuid,  -- Julia Tischler
    '24d01d2e-a693-4a77-9cfd-018db0c491f8'::uuid,  -- Rafaela
    '58123d10-9802-4e3b-93fe-1fe668b280ee'::uuid,  -- Susi
    '72678301-448a-49d2-a282-c5fd72fd4b67'::uuid,  -- STEF
    'b3af1781-6a8e-44b0-8a87-bb623288ea24'::uuid,  -- Max
    'c8be3afb-14e8-4f1a-9e62-3b25831c475f'::uuid,  -- Julia
    'e415df48-7eab-4976-a460-e06fa21c8ad8'::uuid,  -- Max
    '5699e408-208e-49d3-9d23-24ed4f4cfaff'::uuid,  -- JULSI
    '6c4a143d-229e-4e04-9695-b3cc00214d92'::uuid,  -- Julia
    'b0713941-f6ef-48e7-9ed3-71f416372078'::uuid,  -- Stefanie
    'b9f85fe2-2192-4120-b8f9-96f03697fb0e'::uuid,  -- Susi
    'e0733fca-95a2-4255-aa50-aa43534afbed'::uuid,  -- Stefanie
    'f6ceef0f-ca9a-45a6-9795-dbffdf57ee87'::uuid   -- Steffi
  ];
  v_deleted int := 0;
  v_total   int := 0;
BEGIN
  FOREACH v_sid IN ARRAY v_sids LOOP
    SELECT COALESCE(auth_user_id, id) INTO v_uid
    FROM public.students WHERE id = v_sid;

    CONTINUE WHEN v_uid IS NULL;

    DELETE FROM public.daily_results
    WHERE user_id = v_uid
      AND date < '2026-05-31';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_total := v_total + v_deleted;

    -- Punkte zurücksetzen
    UPDATE public.students SET points = 0 WHERE id = v_sid;
    UPDATE public.profiles SET points = 0 WHERE id = v_uid;

    RAISE NOTICE 'student % (uid=%): % Zeilen gelöscht, Punkte zurückgesetzt', v_sid, v_uid, v_deleted;
  END LOOP;

  RAISE NOTICE '✓ Gesamt gelöscht: % Zeilen', v_total;
END;
$$;

-- Diagnose: verbleibende Daten nach dem Cleanup
SELECT
  s.first_name,
  s.id           AS student_id,
  COUNT(dr.date) AS verbleibende_tage
FROM public.students s
LEFT JOIN public.daily_results dr
  ON dr.user_id = COALESCE(s.auth_user_id, s.id)
WHERE s.class_id = '1651d5b5-bc63-47c5-b70e-a25a7b73c259'
GROUP BY s.id, s.first_name
ORDER BY s.first_name;
