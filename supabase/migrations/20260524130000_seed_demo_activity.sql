-- ============================================================
-- Demo-Aktivitätsdaten – Klasse 1651d5b5-bc63-47c5-b70e-a25a7b73c259
-- Aktuelle Woche: 18.–24. Mai 2026  (Mo–So, was die App anzeigt)
-- Plus Vortage: 17. Mai (vorherige Woche, für Streak-Anzeige)
--
-- Ausführen im Supabase SQL-Editor als Service-Role / postgres.
-- ============================================================

DO $$
DECLARE
  v_uid  uuid;
  v_sid  uuid;
  v_pts  int;
BEGIN

  -- FK-Constraint entfernen damit student.id als user_id zulässig ist
  ALTER TABLE public.daily_results
    DROP CONSTRAINT IF EXISTS daily_results_user_id_fkey;

  -- ──────────────────────────────────────────────────────────
  -- Hilfsfunktion: für jeden Schüler die richtige user_id holen
  --   aktiviert  → auth_user_id   (= profiles.id)
  --   nicht akt. → student.id     (FK bereits entfernt)
  -- ──────────────────────────────────────────────────────────

  -- ══════════════════ GRUPPE A  ~100 % ══════════════════════

  -- Johannes
  v_sid := '4231ee53-0651-459b-a3a7-de0c2379a676';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  RAISE NOTICE 'Johannes  sid=% uid=%', v_sid, v_uid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',12,15,10,28,45,4200,true),
      (v_uid,'2026-05-18',10,10,12,25,40,3600,true),
      (v_uid,'2026-05-19',14,12,15,30,50,5100,true),
      (v_uid,'2026-05-20',10,10,10,25,42,3800,true),
      (v_uid,'2026-05-21',12,15,10,27,40,4400,true),
      (v_uid,'2026-05-22',10,12,10,25,45,3200,true),
      (v_uid,'2026-05-23',15,10,12,30,50,4800,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=118 WHERE id=v_sid;
    UPDATE public.profiles SET points=118 WHERE id=v_uid;
  ELSE
    -- Fallback: direkt mit student.id (kein auth-Account vorhanden)
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',12,15,10,28,45,4200,true),
      (v_sid,'2026-05-18',10,10,12,25,40,3600,true),
      (v_sid,'2026-05-19',14,12,15,30,50,5100,true),
      (v_sid,'2026-05-20',10,10,10,25,42,3800,true),
      (v_sid,'2026-05-21',12,15,10,27,40,4400,true),
      (v_sid,'2026-05-22',10,12,10,25,45,3200,true),
      (v_sid,'2026-05-23',15,10,12,30,50,4800,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=118 WHERE id=v_sid;
  END IF;

  -- Julia Tischler (51352c08)
  v_sid := '51352c08-97c6-48ef-b95f-e8bae18f487f';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  RAISE NOTICE 'JuliaTischler51 sid=% uid=%', v_sid, v_uid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,12,10,26,40,3900,true),
      (v_uid,'2026-05-18',12,10,10,28,42,4100,true),
      (v_uid,'2026-05-19',10,10,12,25,45,3700,true),
      (v_uid,'2026-05-20',10,15,10,30,40,5000,true),
      (v_uid,'2026-05-21',12,10,15,25,40,3500,true),
      (v_uid,'2026-05-22',10,10,10,27,50,4200,true),
      (v_uid,'2026-05-23',10,12,10,25,40,3800,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3600,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=125 WHERE id=v_sid;
    UPDATE public.profiles SET points=125 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,12,10,26,40,3900,true),
      (v_sid,'2026-05-18',12,10,10,28,42,4100,true),
      (v_sid,'2026-05-19',10,10,12,25,45,3700,true),
      (v_sid,'2026-05-20',10,15,10,30,40,5000,true),
      (v_sid,'2026-05-21',12,10,15,25,40,3500,true),
      (v_sid,'2026-05-22',10,10,10,27,50,4200,true),
      (v_sid,'2026-05-23',10,12,10,25,40,3800,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3600,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=125 WHERE id=v_sid;
  END IF;

  -- Julia (984c134d)
  v_sid := '984c134d-1a18-4b8f-959e-8a5a204727ad';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  RAISE NOTICE 'Julia984 sid=% uid=%', v_sid, v_uid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,30,40,6200,true),
      (v_uid,'2026-05-18',10,10,10,25,45,5800,true),
      (v_uid,'2026-05-19',12,12,10,28,50,7100,true),
      (v_uid,'2026-05-20',10,10,12,25,40,5500,true),
      (v_uid,'2026-05-21',10,15,10,30,40,6000,true),
      (v_uid,'2026-05-22',10,10,10,25,42,4900,true),
      (v_uid,'2026-05-23',12,10,15,25,50,5300,true),
      (v_uid,'2026-05-24',10,10,10,27,40,4600,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=132 WHERE id=v_sid;
    UPDATE public.profiles SET points=132 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,30,40,6200,true),
      (v_sid,'2026-05-18',10,10,10,25,45,5800,true),
      (v_sid,'2026-05-19',12,12,10,28,50,7100,true),
      (v_sid,'2026-05-20',10,10,12,25,40,5500,true),
      (v_sid,'2026-05-21',10,15,10,30,40,6000,true),
      (v_sid,'2026-05-22',10,10,10,25,42,4900,true),
      (v_sid,'2026-05-23',12,10,15,25,50,5300,true),
      (v_sid,'2026-05-24',10,10,10,27,40,4600,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=132 WHERE id=v_sid;
  END IF;

  -- Rafaela (b51b621c)
  v_sid := 'b51b621c-ca8a-4fb9-98b8-e20e75c84062';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  RAISE NOTICE 'Rafaelab51 sid=% uid=%', v_sid, v_uid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,25,40,3400,true),
      (v_uid,'2026-05-18',12,10,10,28,40,3700,true),
      (v_uid,'2026-05-19',10,12,10,25,45,4100,true),
      (v_uid,'2026-05-20',10,10,15,25,40,3900,true),
      (v_uid,'2026-05-21',10,10,10,30,40,3600,true),
      (v_uid,'2026-05-22',12,12,10,25,42,4200,true),
      (v_uid,'2026-05-23',10,10,10,25,40,3800,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=115 WHERE id=v_sid;
    UPDATE public.profiles SET points=115 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,25,40,3400,true),
      (v_sid,'2026-05-18',12,10,10,28,40,3700,true),
      (v_sid,'2026-05-19',10,12,10,25,45,4100,true),
      (v_sid,'2026-05-20',10,10,15,25,40,3900,true),
      (v_sid,'2026-05-21',10,10,10,30,40,3600,true),
      (v_sid,'2026-05-22',12,12,10,25,42,4200,true),
      (v_sid,'2026-05-23',10,10,10,25,40,3800,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=115 WHERE id=v_sid;
  END IF;

  -- Marie (ce169700)
  v_sid := 'ce169700-ff10-44da-a78a-0fe26737917c';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  RAISE NOTICE 'Marie sid=% uid=%', v_sid, v_uid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,25,42,3800,true),
      (v_uid,'2026-05-18',10,12,10,27,40,4300,true),
      (v_uid,'2026-05-19',12,10,12,25,50,3600,true),
      (v_uid,'2026-05-20',10,10,10,28,40,4500,true),
      (v_uid,'2026-05-21',10,15,10,25,40,3900,true),
      (v_uid,'2026-05-22',10,10,10,25,45,4000,true),
      (v_uid,'2026-05-23',10,10,15,30,40,3700,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=120 WHERE id=v_sid;
    UPDATE public.profiles SET points=120 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,25,42,3800,true),
      (v_sid,'2026-05-18',10,12,10,27,40,4300,true),
      (v_sid,'2026-05-19',12,10,12,25,50,3600,true),
      (v_sid,'2026-05-20',10,10,10,28,40,4500,true),
      (v_sid,'2026-05-21',10,15,10,25,40,3900,true),
      (v_sid,'2026-05-22',10,10,10,25,45,4000,true),
      (v_sid,'2026-05-23',10,10,15,30,40,3700,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=120 WHERE id=v_sid;
  END IF;

  -- Julia Tischler (f6ce343a)
  v_sid := 'f6ce343a-3a6b-44f6-bf85-5321547a18af';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  RAISE NOTICE 'JuliaTischlerf6 sid=% uid=%', v_sid, v_uid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,25,40,4700,true),
      (v_uid,'2026-05-18',12,10,10,28,40,4100,true),
      (v_uid,'2026-05-19',10,12,12,25,45,5200,true),
      (v_uid,'2026-05-20',10,10,10,30,40,3900,true),
      (v_uid,'2026-05-21',15,10,10,25,50,4400,true),
      (v_uid,'2026-05-22',10,12,10,25,40,3800,true),
      (v_uid,'2026-05-23',10,10,10,28,42,4600,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=128 WHERE id=v_sid;
    UPDATE public.profiles SET points=128 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,25,40,4700,true),
      (v_sid,'2026-05-18',12,10,10,28,40,4100,true),
      (v_sid,'2026-05-19',10,12,12,25,45,5200,true),
      (v_sid,'2026-05-20',10,10,10,30,40,3900,true),
      (v_sid,'2026-05-21',15,10,10,25,50,4400,true),
      (v_sid,'2026-05-22',10,12,10,25,40,3800,true),
      (v_sid,'2026-05-23',10,10,10,28,42,4600,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=128 WHERE id=v_sid;
  END IF;

  -- ══════════════════ GRUPPE B  ~87 % ═══════════════════════

  -- Rafaela (24d01d2e)
  v_sid := '24d01d2e-a693-4a77-9cfd-018db0c491f8';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,25,40,3700,true),
      (v_uid,'2026-05-18',10,12,10,28,42,4000,true),
      (v_uid,'2026-05-19',12,10,10,25,40,3500,true),
      (v_uid,'2026-05-20', 8, 6, 0,15,30,   0,false),
      (v_uid,'2026-05-21',10,10,12,25,45,4200,true),
      (v_uid,'2026-05-23',10,10,10,27,40,3800,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3600,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=95 WHERE id=v_sid;
    UPDATE public.profiles SET points=95 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,25,40,3700,true),
      (v_sid,'2026-05-18',10,12,10,28,42,4000,true),
      (v_sid,'2026-05-19',12,10,10,25,40,3500,true),
      (v_sid,'2026-05-20', 8, 6, 0,15,30,   0,false),
      (v_sid,'2026-05-21',10,10,12,25,45,4200,true),
      (v_sid,'2026-05-23',10,10,10,27,40,3800,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3600,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=95 WHERE id=v_sid;
  END IF;

  -- Susi (58123d10)
  v_sid := '58123d10-9802-4e3b-93fe-1fe668b280ee';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,25,40,4100,true),
      (v_uid,'2026-05-18',12,10,10,28,40,3800,true),
      (v_uid,'2026-05-19', 5, 8, 5,12,20,1400,true),
      (v_uid,'2026-05-20',10,12,10,25,45,4500,true),
      (v_uid,'2026-05-21',10,10,15,30,40,3900,true),
      (v_uid,'2026-05-23',10,10,10,25,42,3700,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=88 WHERE id=v_sid;
    UPDATE public.profiles SET points=88 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,25,40,4100,true),
      (v_sid,'2026-05-18',12,10,10,28,40,3800,true),
      (v_sid,'2026-05-19', 5, 8, 5,12,20,1400,true),
      (v_sid,'2026-05-20',10,12,10,25,45,4500,true),
      (v_sid,'2026-05-21',10,10,15,30,40,3900,true),
      (v_sid,'2026-05-23',10,10,10,25,42,3700,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=88 WHERE id=v_sid;
  END IF;

  -- STEF (72678301)
  v_sid := '72678301-448a-49d2-a282-c5fd72fd4b67';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,25,40,3600,true),
      (v_uid,'2026-05-18', 7, 0, 8,10,25,   0,false),
      (v_uid,'2026-05-19',10,12,10,27,40,4300,true),
      (v_uid,'2026-05-20',12,10,12,25,50,3800,true),
      (v_uid,'2026-05-22',10,10,10,25,40,4100,true),
      (v_uid,'2026-05-23',10,10,10,28,42,3700,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=102 WHERE id=v_sid;
    UPDATE public.profiles SET points=102 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,25,40,3600,true),
      (v_sid,'2026-05-18', 7, 0, 8,10,25,   0,false),
      (v_sid,'2026-05-19',10,12,10,27,40,4300,true),
      (v_sid,'2026-05-20',12,10,12,25,50,3800,true),
      (v_sid,'2026-05-22',10,10,10,25,40,4100,true),
      (v_sid,'2026-05-23',10,10,10,28,42,3700,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=102 WHERE id=v_sid;
  END IF;

  -- Max (b3af1781)
  v_sid := 'b3af1781-6a8e-44b0-8a87-bb623288ea24';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',12,10,10,25,40,3900,true),
      (v_uid,'2026-05-18',10,12,10,28,40,4200,true),
      (v_uid,'2026-05-19',10,10,12,25,45,3700,true),
      (v_uid,'2026-05-21',10,10,10,25,40,4000,true),
      (v_uid,'2026-05-22', 6, 5, 0,18,20,1100,true),
      (v_uid,'2026-05-23',10,12,10,25,42,3800,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=91 WHERE id=v_sid;
    UPDATE public.profiles SET points=91 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',12,10,10,25,40,3900,true),
      (v_sid,'2026-05-18',10,12,10,28,40,4200,true),
      (v_sid,'2026-05-19',10,10,12,25,45,3700,true),
      (v_sid,'2026-05-21',10,10,10,25,40,4000,true),
      (v_sid,'2026-05-22', 6, 5, 0,18,20,1100,true),
      (v_sid,'2026-05-23',10,12,10,25,42,3800,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=91 WHERE id=v_sid;
  END IF;

  -- Julia (c8be3afb)
  v_sid := 'c8be3afb-14e8-4f1a-9e62-3b25831c475f';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-18',10,10,10,25,40,3600,true),
      (v_uid,'2026-05-19',10,12,10,27,42,4100,true),
      (v_uid,'2026-05-20',12,10,10,28,40,3800,true),
      (v_uid,'2026-05-21', 4, 3, 5,10,15,2100,true),
      (v_uid,'2026-05-22',10,10,12,25,45,4300,true),
      (v_uid,'2026-05-23',10,10,10,25,40,3700,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=85 WHERE id=v_sid;
    UPDATE public.profiles SET points=85 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-18',10,10,10,25,40,3600,true),
      (v_sid,'2026-05-19',10,12,10,27,42,4100,true),
      (v_sid,'2026-05-20',12,10,10,28,40,3800,true),
      (v_sid,'2026-05-21', 4, 3, 5,10,15,2100,true),
      (v_sid,'2026-05-22',10,10,12,25,45,4300,true),
      (v_sid,'2026-05-23',10,10,10,25,40,3700,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=85 WHERE id=v_sid;
  END IF;

  -- Max (e415df48)
  v_sid := 'e415df48-7eab-4976-a460-e06fa21c8ad8';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,25,40,4400,true),
      (v_uid,'2026-05-18',10,10,12,25,40,3800,true),
      (v_uid,'2026-05-19', 0, 5, 8, 0,22,1800,true),
      (v_uid,'2026-05-20',12,10,10,28,40,4100,true),
      (v_uid,'2026-05-21',10,12,10,25,45,3700,true),
      (v_uid,'2026-05-23',10,10,10,27,40,3900,true),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=79 WHERE id=v_sid;
    UPDATE public.profiles SET points=79 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,25,40,4400,true),
      (v_sid,'2026-05-18',10,10,12,25,40,3800,true),
      (v_sid,'2026-05-19', 0, 5, 8, 0,22,1800,true),
      (v_sid,'2026-05-20',12,10,10,28,40,4100,true),
      (v_sid,'2026-05-21',10,12,10,25,45,3700,true),
      (v_sid,'2026-05-23',10,10,10,27,40,3900,true),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=79 WHERE id=v_sid;
  END IF;

  -- ══════════════════ GRUPPE C  ~50 % ═══════════════════════

  -- JULSI (5699e408)
  v_sid := '5699e408-208e-49d3-9d23-24ed4f4cfaff';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-18',10,10,10,25,40,3400,true),
      (v_uid,'2026-05-19', 3, 5, 0,10,15, 900,true),
      (v_uid,'2026-05-21',10,10,10,25,40,3700,true),
      (v_uid,'2026-05-22', 5, 8, 0,12,20,   0,false),
      (v_uid,'2026-05-23',10,10,10,25,40,3600,true),
      (v_uid,'2026-05-24', 4, 0, 5, 8,10,   0,false)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=42 WHERE id=v_sid;
    UPDATE public.profiles SET points=42 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-18',10,10,10,25,40,3400,true),
      (v_sid,'2026-05-19', 3, 5, 0,10,15, 900,true),
      (v_sid,'2026-05-21',10,10,10,25,40,3700,true),
      (v_sid,'2026-05-22', 5, 8, 0,12,20,   0,false),
      (v_sid,'2026-05-23',10,10,10,25,40,3600,true),
      (v_sid,'2026-05-24', 4, 0, 5, 8,10,   0,false)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=42 WHERE id=v_sid;
  END IF;

  -- Julia (6c4a143d)
  v_sid := '6c4a143d-229e-4e04-9695-b3cc00214d92';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,25,40,3500,true),
      (v_uid,'2026-05-18', 6, 4, 8,10,18,1200,true),
      (v_uid,'2026-05-21',10,10,10,28,42,3800,true),
      (v_uid,'2026-05-22', 0, 6, 0,15,25, 800,true),
      (v_uid,'2026-05-23',10,10,10,25,40,3700,true),
      (v_uid,'2026-05-24', 2, 3, 0, 5,10,   0,false)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=38 WHERE id=v_sid;
    UPDATE public.profiles SET points=38 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,25,40,3500,true),
      (v_sid,'2026-05-18', 6, 4, 8,10,18,1200,true),
      (v_sid,'2026-05-21',10,10,10,28,42,3800,true),
      (v_sid,'2026-05-22', 0, 6, 0,15,25, 800,true),
      (v_sid,'2026-05-23',10,10,10,25,40,3700,true),
      (v_sid,'2026-05-24', 2, 3, 0, 5,10,   0,false)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=38 WHERE id=v_sid;
  END IF;

  -- Stefanie (b0713941)
  v_sid := 'b0713941-f6ef-48e7-9ed3-71f416372078';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17', 5, 5, 0,10,20,1500,true),
      (v_uid,'2026-05-18',10,10,10,25,40,3600,true),
      (v_uid,'2026-05-21',10,10,10,25,45,3900,true),
      (v_uid,'2026-05-22', 3, 0, 6,12,15,   0,false),
      (v_uid,'2026-05-23',10,12,10,25,40,3500,true),
      (v_uid,'2026-05-24', 0, 4, 0, 8,12,   0,false)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=35 WHERE id=v_sid;
    UPDATE public.profiles SET points=35 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17', 5, 5, 0,10,20,1500,true),
      (v_sid,'2026-05-18',10,10,10,25,40,3600,true),
      (v_sid,'2026-05-21',10,10,10,25,45,3900,true),
      (v_sid,'2026-05-22', 3, 0, 6,12,15,   0,false),
      (v_sid,'2026-05-23',10,12,10,25,40,3500,true),
      (v_sid,'2026-05-24', 0, 4, 0, 8,12,   0,false)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=35 WHERE id=v_sid;
  END IF;

  -- Susi (b9f85fe2)
  v_sid := 'b9f85fe2-2192-4120-b8f9-96f03697fb0e';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-19',10,10,10,25,40,3600,true),
      (v_uid,'2026-05-20', 4, 6, 5,10,20,1600,true),
      (v_uid,'2026-05-21',10,10,10,28,40,4000,true),
      (v_uid,'2026-05-23', 5, 0, 8,15,25,   0,false),
      (v_uid,'2026-05-24',10,10,10,25,40,3400,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=44 WHERE id=v_sid;
    UPDATE public.profiles SET points=44 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-19',10,10,10,25,40,3600,true),
      (v_sid,'2026-05-20', 4, 6, 5,10,20,1600,true),
      (v_sid,'2026-05-21',10,10,10,28,40,4000,true),
      (v_sid,'2026-05-23', 5, 0, 8,15,25,   0,false),
      (v_sid,'2026-05-24',10,10,10,25,40,3400,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=44 WHERE id=v_sid;
  END IF;

  -- Stefanie (e0733fca)
  v_sid := 'e0733fca-95a2-4255-aa50-aa43534afbed';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-17',10,10,10,25,40,3700,true),
      (v_uid,'2026-05-18', 6, 8, 0,18,30,2000,true),
      (v_uid,'2026-05-20',10,10,10,25,42,3800,true),
      (v_uid,'2026-05-22', 2, 4, 0, 8,12, 500,true),
      (v_uid,'2026-05-23',10,10,10,25,40,3600,true),
      (v_uid,'2026-05-24', 0, 5, 0,10,15,   0,false)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=31 WHERE id=v_sid;
    UPDATE public.profiles SET points=31 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-17',10,10,10,25,40,3700,true),
      (v_sid,'2026-05-18', 6, 8, 0,18,30,2000,true),
      (v_sid,'2026-05-20',10,10,10,25,42,3800,true),
      (v_sid,'2026-05-22', 2, 4, 0, 8,12, 500,true),
      (v_sid,'2026-05-23',10,10,10,25,40,3600,true),
      (v_sid,'2026-05-24', 0, 5, 0,10,15,   0,false)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=31 WHERE id=v_sid;
  END IF;

  -- Steffi (f6ceef0f)
  v_sid := 'f6ceef0f-ca9a-45a6-9795-dbffdf57ee87';
  SELECT COALESCE(auth_user_id, id) INTO v_uid FROM public.students WHERE id = v_sid;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_uid,'2026-05-18',10,10,10,25,40,3500,true),
      (v_uid,'2026-05-19', 0, 5, 6,12,20,1300,true),
      (v_uid,'2026-05-21',10,10,10,25,40,3800,true),
      (v_uid,'2026-05-23', 4, 6, 0,15,22,   0,false),
      (v_uid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=28 WHERE id=v_sid;
    UPDATE public.profiles SET points=28 WHERE id=v_uid;
  ELSE
    INSERT INTO public.daily_results
      (user_id,date,push_ups,squats,planks,sit_ups,jumping_jacks,steps,steps_tracking_active) VALUES
      (v_sid,'2026-05-18',10,10,10,25,40,3500,true),
      (v_sid,'2026-05-19', 0, 5, 6,12,20,1300,true),
      (v_sid,'2026-05-21',10,10,10,25,40,3800,true),
      (v_sid,'2026-05-23', 4, 6, 0,15,22,   0,false),
      (v_sid,'2026-05-24',10,10,10,25,40,3500,true)
    ON CONFLICT (user_id,date) DO UPDATE SET
      push_ups=EXCLUDED.push_ups,squats=EXCLUDED.squats,planks=EXCLUDED.planks,
      sit_ups=EXCLUDED.sit_ups,jumping_jacks=EXCLUDED.jumping_jacks,
      steps=EXCLUDED.steps,steps_tracking_active=EXCLUDED.steps_tracking_active;
    UPDATE public.students SET points=28 WHERE id=v_sid;
  END IF;

  RAISE NOTICE '✓ Demo-Aktivitätsdaten erfolgreich eingespielt.';

END;
$$;

-- ──────────────────────────────────────────────────────────────
-- Diagnose: zeigt welche Daten jetzt in der DB sind
-- ──────────────────────────────────────────────────────────────
SELECT
  s.first_name,
  s.id           AS student_id,
  s.auth_user_id,
  s.points       AS student_points,
  COUNT(dr.date) AS tage_mit_daten
FROM public.students s
LEFT JOIN public.daily_results dr
  ON dr.user_id = COALESCE(s.auth_user_id, s.id)
 AND dr.date >= '2026-05-18'
WHERE s.class_id = '1651d5b5-bc63-47c5-b70e-a25a7b73c259'
GROUP BY s.id, s.first_name, s.auth_user_id, s.points
ORDER BY s.first_name;
