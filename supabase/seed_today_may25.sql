-- ============================================================
-- Heutige Aktivität – 25. Mai 2026
-- Gruppe A: 100% (6/6 Aufgaben)
-- Gruppe B: ~67–83% (4–5/6 Aufgaben)
-- Gruppe C: ~50% (3/6 Aufgaben)
-- ============================================================

DO $$
DECLARE
  v_uid uuid;
  v_sid uuid;
  d     date := '2026-05-25';
BEGIN

  ALTER TABLE public.daily_results DROP CONSTRAINT IF EXISTS daily_results_user_id_fkey;

  -- ── GRUPPE A  100 % ────────────────────────────────────────

  -- Johannes
  v_sid := '4231ee53-0651-459b-a3a7-de0c2379a676';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,12,14,11,28,48,4200,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Lea (51352c08)
  v_sid := '51352c08-97c6-48ef-b95f-e8bae18f487f';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,12,10,26,42,3800,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Emma (984c134d)
  v_sid := '984c134d-1a18-4b8f-959e-8a5a204727ad';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,11,10,27,45,5200,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Rafaela (b51b621c)
  v_sid := 'b51b621c-ca8a-4fb9-98b8-e20e75c84062';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,25,40,3500,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Marie (ce169700)
  v_sid := 'ce169700-ff10-44da-a78a-0fe26737917c';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,11,10,12,30,44,4000,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Sophie (f6ce343a)
  v_sid := 'f6ce343a-3a6b-44f6-bf85-5321547a18af';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,25,40,3600,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- ── GRUPPE B  ~67–83 % ─────────────────────────────────────
  -- 4 von 6 Aufgaben erfüllt: push_ups ✓ squats ✓ planks ✓ sit_ups ✓  |  jacks ✗ steps ✗

  -- Clara (24d01d2e)
  v_sid := '24d01d2e-a693-4a77-9cfd-018db0c491f8';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,25,22,1800,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Susi (58123d10)
  v_sid := '58123d10-9802-4e3b-93fe-1fe668b280ee';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,12,10,11,28,18,2200,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Stefan (72678301) – 5/6 (nur steps fehlen)
  v_sid := '72678301-448a-49d2-a282-c5fd72fd4b67';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,12,10,10,27,43,2400,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Max (b3af1781)
  v_sid := 'b3af1781-6a8e-44b0-8a87-bb623288ea24';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,11,10,26,25,1500,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Anna (c8be3afb) – 5/6
  v_sid := 'c8be3afb-14e8-4f1a-9e62-3b25831c475f';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,25,41,2600,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Lukas (e415df48)
  v_sid := 'e415df48-7eab-4976-a460-e06fa21c8ad8';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,25,20,1900,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- ── GRUPPE C  ~50 % ────────────────────────────────────────
  -- 3 von 6 Aufgaben erfüllt: push_ups ✓ squats ✓ planks ✓  |  sit_ups ✗ jacks ✗ steps ✗

  -- Juliane (5699e408)
  v_sid := '5699e408-208e-49d3-9d23-24ed4f4cfaff';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,15,22,1200,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Mia (6c4a143d)
  v_sid := '6c4a143d-229e-4e04-9695-b3cc00214d92';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,12,18,900,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Stefanie (b0713941)
  v_sid := 'b0713941-f6ef-48e7-9ed3-71f416372078';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,11,10,10,14,20,1400,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Laura (b9f85fe2)
  v_sid := 'b9f85fe2-2192-4120-b8f9-96f03697fb0e';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,16,25,1100,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Nina (e0733fca)
  v_sid := 'e0733fca-95a2-4255-aa50-aa43534afbed';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,18,28,800,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  -- Lisa (f6ceef0f)
  v_sid := 'f6ceef0f-ca9a-45a6-9795-dbffdf57ee87';
  SELECT COALESCE(auth_user_id,id) INTO v_uid FROM public.students WHERE id=v_sid;
  v_uid := COALESCE(v_uid,v_sid);
  INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
  VALUES(v_uid,d,10,10,10,10,15,1300,true)
  ON CONFLICT(user_id,date) DO UPDATE SET push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;

  RAISE NOTICE '✓ Heutige Aktivität (25.05.2026) eingespielt.';

END;
$$;

-- Kontrolle
SELECT s.first_name,
  dr.push_ups, dr.squats, dr.planks, dr.sit_ups, dr.jumping_jacks, dr.steps,
  (CASE WHEN dr.push_ups>=10 THEN 1 ELSE 0 END +
   CASE WHEN dr.squats>=10  THEN 1 ELSE 0 END +
   CASE WHEN dr.planks>=10  THEN 1 ELSE 0 END +
   CASE WHEN dr.sit_ups>=25 THEN 1 ELSE 0 END +
   CASE WHEN dr.jumping_jacks>=40 THEN 1 ELSE 0 END +
   CASE WHEN dr.steps>=3000 THEN 1 ELSE 0 END) AS aufgaben_erledigt
FROM public.students s
JOIN public.daily_results dr ON dr.user_id=COALESCE(s.auth_user_id,s.id) AND dr.date='2026-05-25'
WHERE s.class_id='1651d5b5-bc63-47c5-b70e-a25a7b73c259'
ORDER BY aufgaben_erledigt DESC, s.first_name;
