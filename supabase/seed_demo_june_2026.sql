-- ============================================================
-- Demo-Aktivitätsdaten – Klasse 1651d5b5-bc63-47c5-b70e-a25a7b73c259
-- Zeitraum: 25. Mai – 30. Juni 2026
--   (schließt lückenlos an den Mai-Seed an und deckt den gesamten Juni)
--
-- Gruppe A (~100 %): 6 Schüler – jeden Tag alle 6 Aufgaben erfüllt
-- Gruppe B (~87 %):  6 Schüler – ~32/37 Tage aktiv, ~5 Ausfallstage
-- Gruppe C (~50 %):  6 Schüler – ungerade / gerade Tage aktiv (~18/37)
--
-- Ausführen im Supabase SQL-Editor als Service-Role / postgres.
-- ============================================================

DO $$
DECLARE
  v_uid  uuid;
  v_sid  uuid;
  v_date date;
  v_doy  int;   -- fortlaufender Tag ab 25. Mai (1,2,3,...37)
  v_dom  int;   -- Tag des Monats (für natürliche Variation)
BEGIN

  ALTER TABLE public.daily_results DROP CONSTRAINT IF EXISTS daily_results_user_id_fkey;

  -- ════════════════════════════════════════════════════════════
  -- GRUPPE A  ~100 %  – jeden Tag vollständig
  -- ════════════════════════════════════════════════════════════

  -- Johannes (4231ee53)
  v_sid := '4231ee53-0651-459b-a3a7-de0c2379a676';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
    VALUES(v_uid,v_date,10+(v_dom%6),10+(v_dom%7),10+(v_dom%5),25+(v_dom%9),40+(v_dom%13),3400+(v_dom%9)*320,true)
    ON CONFLICT(user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
  END LOOP;
  UPDATE public.students SET points=520 WHERE id=v_sid;
  UPDATE public.profiles SET points=520 WHERE id=v_uid;

  -- Julia Tischler (51352c08)
  v_sid := '51352c08-97c6-48ef-b95f-e8bae18f487f';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
    VALUES(v_uid,v_date,10+(v_dom%5),12+(v_dom%6),10+(v_dom%4),26+(v_dom%8),42+(v_dom%11),3600+(v_dom%8)*350,true)
    ON CONFLICT(user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
  END LOOP;
  UPDATE public.students SET points=538 WHERE id=v_sid;
  UPDATE public.profiles SET points=538 WHERE id=v_uid;

  -- Julia (984c134d)
  v_sid := '984c134d-1a18-4b8f-959e-8a5a204727ad';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
    VALUES(v_uid,v_date,12+(v_dom%5),10+(v_dom%8),11+(v_dom%4),27+(v_dom%9),40+(v_dom%14),4800+(v_dom%9)*250,true)
    ON CONFLICT(user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
  END LOOP;
  UPDATE public.students SET points=557 WHERE id=v_sid;
  UPDATE public.profiles SET points=557 WHERE id=v_uid;

  -- Rafaela (b51b621c)
  v_sid := 'b51b621c-ca8a-4fb9-98b8-e20e75c84062';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
    VALUES(v_uid,v_date,10+(v_dom%7),10+(v_dom%5),10+(v_dom%6),25+(v_dom%7),40+(v_dom%12),3300+(v_dom%10)*290,true)
    ON CONFLICT(user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
  END LOOP;
  UPDATE public.students SET points=502 WHERE id=v_sid;
  UPDATE public.profiles SET points=502 WHERE id=v_uid;

  -- Marie (ce169700)
  v_sid := 'ce169700-ff10-44da-a78a-0fe26737917c';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
    VALUES(v_uid,v_date,10+(v_dom%6),10+(v_dom%4),12+(v_dom%5),25+(v_dom%10),41+(v_dom%12),3500+(v_dom%8)*300,true)
    ON CONFLICT(user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
  END LOOP;
  UPDATE public.students SET points=531 WHERE id=v_sid;
  UPDATE public.profiles SET points=531 WHERE id=v_uid;

  -- Julia Tischler (f6ce343a)
  v_sid := 'f6ce343a-3a6b-44f6-bf85-5321547a18af';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
    VALUES(v_uid,v_date,11+(v_dom%5),10+(v_dom%6),10+(v_dom%7),26+(v_dom%8),40+(v_dom%11),3800+(v_dom%7)*380,true)
    ON CONFLICT(user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
  END LOOP;
  UPDATE public.students SET points=545 WHERE id=v_sid;
  UPDATE public.profiles SET points=545 WHERE id=v_uid;

  -- ════════════════════════════════════════════════════════════
  -- GRUPPE B  ~87 %  – ~32/37 Tage aktiv
  -- Ausfallstage per Schüler variieren (dom-basiert)
  -- ════════════════════════════════════════════════════════════

  -- Rafaela (24d01d2e) – Ausfallstage dom IN (6,13,20,27,4)
  v_sid := '24d01d2e-a693-4a77-9cfd-018db0c491f8';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom NOT IN (4,6,13,20,27) THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%6),10+(v_dom%5),10+(v_dom%4),25+(v_dom%8),40+(v_dom%12),3400+(v_dom%9)*310,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,4,3,0,8,15,0,false)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=435 WHERE id=v_sid;
  UPDATE public.profiles SET points=435 WHERE id=v_uid;

  -- Susi (58123d10) – Ausfallstage dom IN (7,14,21,28,25)
  v_sid := '58123d10-9802-4e3b-93fe-1fe668b280ee';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom NOT IN (7,14,21,25,28) THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%5),10+(v_dom%7),10+(v_dom%5),26+(v_dom%8),41+(v_dom%11),3600+(v_dom%8)*340,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,5,4,0,10,18,1200,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=452 WHERE id=v_sid;
  UPDATE public.profiles SET points=452 WHERE id=v_uid;

  -- STEF (72678301) – Ausfallstage dom IN (3,11,22,29,26)
  v_sid := '72678301-448a-49d2-a282-c5fd72fd4b67';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom NOT IN (3,11,22,26,29) THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,12+(v_dom%5),10+(v_dom%6),10+(v_dom%6),25+(v_dom%9),40+(v_dom%13),3700+(v_dom%7)*330,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,6,0,5,10,22,0,false)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=468 WHERE id=v_sid;
  UPDATE public.profiles SET points=468 WHERE id=v_uid;

  -- Max (b3af1781) – Ausfallstage dom IN (5,12,23,30,27)
  v_sid := 'b3af1781-6a8e-44b0-8a87-bb623288ea24';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom NOT IN (5,12,23,27,30) THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%7),10+(v_dom%5),10+(v_dom%5),25+(v_dom%10),40+(v_dom%12),3500+(v_dom%8)*360,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,3,5,0,8,12,800,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=419 WHERE id=v_sid;
  UPDATE public.profiles SET points=419 WHERE id=v_uid;

  -- Julia (c8be3afb) – Ausfallstage dom IN (8,17,24,30,31)
  v_sid := 'c8be3afb-14e8-4f1a-9e62-3b25831c475f';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom NOT IN (8,17,24,30,31) THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%6),11+(v_dom%6),10+(v_dom%4),25+(v_dom%8),42+(v_dom%11),3300+(v_dom%10)*320,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,4,6,5,12,20,1500,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=406 WHERE id=v_sid;
  UPDATE public.profiles SET points=406 WHERE id=v_uid;

  -- Max (e415df48) – Ausfallstage dom IN (2,10,18,25,29)
  v_sid := 'e415df48-7eab-4976-a460-e06fa21c8ad8';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom NOT IN (2,10,18,25,29) THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%5),10+(v_dom%7),10+(v_dom%6),25+(v_dom%9),40+(v_dom%12),3600+(v_dom%9)*300,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,0,5,6,10,20,1800,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=428 WHERE id=v_sid;
  UPDATE public.profiles SET points=428 WHERE id=v_uid;

  -- ════════════════════════════════════════════════════════════
  -- GRUPPE C  ~50 %  – ungerade/gerade Tage aktiv
  -- ════════════════════════════════════════════════════════════

  -- JULSI (5699e408) – aktiv an ungeraden Tagen (dom % 2 = 1)
  v_sid := '5699e408-208e-49d3-9d23-24ed4f4cfaff';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom % 2 = 1 THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%5),10+(v_dom%6),10+(v_dom%4),25+(v_dom%7),40+(v_dom%10),3400+(v_dom%8)*300,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,3,5,0,8,15,0,false)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=192 WHERE id=v_sid;
  UPDATE public.profiles SET points=192 WHERE id=v_uid;

  -- Julia (6c4a143d) – aktiv an geraden Tagen (dom % 2 = 0)
  v_sid := '6c4a143d-229e-4e04-9695-b3cc00214d92';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom % 2 = 0 THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%6),10+(v_dom%5),10+(v_dom%5),25+(v_dom%8),40+(v_dom%11),3500+(v_dom%7)*310,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,2,4,0,6,12,500,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=175 WHERE id=v_sid;
  UPDATE public.profiles SET points=175 WHERE id=v_uid;

  -- Stefanie (b0713941) – aktiv an ungeraden Tagen
  v_sid := 'b0713941-f6ef-48e7-9ed3-71f416372078';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom % 2 = 1 THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%4),10+(v_dom%7),10+(v_dom%5),25+(v_dom%9),41+(v_dom%10),3300+(v_dom%9)*290,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,4,0,5,10,18,0,false)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=166 WHERE id=v_sid;
  UPDATE public.profiles SET points=166 WHERE id=v_uid;

  -- Susi (b9f85fe2) – aktiv an geraden Tagen
  v_sid := 'b9f85fe2-2192-4120-b8f9-96f03697fb0e';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom % 2 = 0 THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%5),10+(v_dom%6),11+(v_dom%4),26+(v_dom%8),40+(v_dom%12),3600+(v_dom%8)*340,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,5,6,0,12,22,1600,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=198 WHERE id=v_sid;
  UPDATE public.profiles SET points=198 WHERE id=v_uid;

  -- Stefanie (e0733fca) – aktiv an ungeraden Tagen
  v_sid := 'e0733fca-95a2-4255-aa50-aa43534afbed';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom % 2 = 1 THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%6),10+(v_dom%5),10+(v_dom%6),25+(v_dom%7),40+(v_dom%11),3400+(v_dom%9)*310,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,2,3,0,8,10,0,false)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=158 WHERE id=v_sid;
  UPDATE public.profiles SET points=158 WHERE id=v_uid;

  -- Steffi (f6ceef0f) – aktiv an geraden Tagen
  v_sid := 'f6ceef0f-ca9a-45a6-9795-dbffdf57ee87';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  v_uid := COALESCE(v_uid, v_sid);
  FOR v_date IN SELECT gs::date FROM generate_series('2026-05-25'::date,'2026-06-30'::date,'1 day') gs LOOP
    v_dom := EXTRACT(day FROM v_date)::int;
    IF v_dom % 2 = 0 THEN
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,10+(v_dom%5),10+(v_dom%4),10+(v_dom%7),25+(v_dom%9),40+(v_dom%10),3500+(v_dom%8)*320,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    ELSE
      INSERT INTO public.daily_results(user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active)
      VALUES(v_uid,v_date,3,5,0,10,16,1000,true)
      ON CONFLICT(user_id,date) DO UPDATE SET
        push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
        sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
        steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    END IF;
  END LOOP;
  UPDATE public.students SET points=182 WHERE id=v_sid;
  UPDATE public.profiles SET points=182 WHERE id=v_uid;

  RAISE NOTICE '✓ Aktivitätsdaten 25.05.–30.06.2026 erfolgreich eingespielt.';

END;
$$;

-- ──────────────────────────────────────────────────────────────
-- Diagnose: Ergebnis pro Schüler für Mai 25 – Juni 30
-- ──────────────────────────────────────────────────────────────
SELECT
  s.first_name,
  s.id           AS student_id,
  s.points       AS punkte,
  COUNT(dr.date) AS tage_gesamt,
  COUNT(dr.date) FILTER (
    WHERE dr.push_ups >= 10 AND dr.squats >= 10
      AND dr.planks   >= 10 AND dr.sit_ups >= 25
      AND dr.jumping_jacks >= 40 AND dr.steps >= 3000
  )              AS aktive_tage
FROM public.students s
LEFT JOIN public.daily_results dr
  ON dr.user_id = COALESCE(s.auth_user_id, s.id)
 AND dr.date >= '2026-05-25' AND dr.date <= '2026-06-30'
WHERE s.class_id = '1651d5b5-bc63-47c5-b70e-a25a7b73c259'
GROUP BY s.id, s.first_name, s.points
ORDER BY aktive_tage DESC, s.first_name;
