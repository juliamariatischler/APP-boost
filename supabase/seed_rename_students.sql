-- ============================================================
-- Namensänderung: Schüler der Klasse 1651d5b5
-- Jeder Name kommt nur noch einmal vor.
--
-- Aktualisiert: students.first_name, students.display_name
--               profiles.username (für aktivierte Schüler)
--
-- Ausführen im Supabase SQL-Editor als Service-Role / postgres.
-- ============================================================

DO $$
DECLARE
  v_sid  uuid;
  v_uid  uuid;
  v_name text;
BEGIN

  -- ═══════════════════════════════════════════
  -- GRUPPE A  ~100 %
  -- ═══════════════════════════════════════════

  -- 4231ee53 → Johannes  (bleibt)
  v_sid := '4231ee53-0651-459b-a3a7-de0c2379a676'; v_name := 'Johannes';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- 51352c08 → Lea  (war: Julia Tischler)
  v_sid := '51352c08-97c6-48ef-b95f-e8bae18f487f'; v_name := 'Lea';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- 984c134d → Emma  (war: Julia)
  v_sid := '984c134d-1a18-4b8f-959e-8a5a204727ad'; v_name := 'Emma';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- b51b621c → Rafaela  (bleibt – eine Rafaela behalten)
  v_sid := 'b51b621c-ca8a-4fb9-98b8-e20e75c84062'; v_name := 'Rafaela';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- ce169700 → Marie  (bleibt)
  v_sid := 'ce169700-ff10-44da-a78a-0fe26737917c'; v_name := 'Marie';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- f6ce343a → Sophie  (war: Julia Tischler)
  v_sid := 'f6ce343a-3a6b-44f6-bf85-5321547a18af'; v_name := 'Sophie';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- ═══════════════════════════════════════════
  -- GRUPPE B  ~87 %
  -- ═══════════════════════════════════════════

  -- 24d01d2e → Clara  (war: Rafaela)
  v_sid := '24d01d2e-a693-4a77-9cfd-018db0c491f8'; v_name := 'Clara';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- 58123d10 → Susi  (bleibt – eine Susi behalten)
  v_sid := '58123d10-9802-4e3b-93fe-1fe668b280ee'; v_name := 'Susi';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- 72678301 → Stefan  (war: STEF)
  v_sid := '72678301-448a-49d2-a282-c5fd72fd4b67'; v_name := 'Stefan';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- b3af1781 → Max  (bleibt – einen Max behalten)
  v_sid := 'b3af1781-6a8e-44b0-8a87-bb623288ea24'; v_name := 'Max';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- c8be3afb → Anna  (war: Julia)
  v_sid := 'c8be3afb-14e8-4f1a-9e62-3b25831c475f'; v_name := 'Anna';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- e415df48 → Lukas  (war: Max)
  v_sid := 'e415df48-7eab-4976-a460-e06fa21c8ad8'; v_name := 'Lukas';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- ═══════════════════════════════════════════
  -- GRUPPE C  ~50 %
  -- ═══════════════════════════════════════════

  -- 5699e408 → Juliane  (war: JULSI)
  v_sid := '5699e408-208e-49d3-9d23-24ed4f4cfaff'; v_name := 'Juliane';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- 6c4a143d → Mia  (war: Julia)
  v_sid := '6c4a143d-229e-4e04-9695-b3cc00214d92'; v_name := 'Mia';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- b0713941 → Stefanie  (bleibt – eine Stefanie behalten)
  v_sid := 'b0713941-f6ef-48e7-9ed3-71f416372078'; v_name := 'Stefanie';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- b9f85fe2 → Laura  (war: Susi)
  v_sid := 'b9f85fe2-2192-4120-b8f9-96f03697fb0e'; v_name := 'Laura';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- e0733fca → Nina  (war: Stefanie)
  v_sid := 'e0733fca-95a2-4255-aa50-aa43534afbed'; v_name := 'Nina';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  -- f6ceef0f → Lisa  (war: Steffi)
  v_sid := 'f6ceef0f-ca9a-45a6-9795-dbffdf57ee87'; v_name := 'Lisa';
  UPDATE public.students SET first_name=v_name, display_name=v_name WHERE id=v_sid;
  SELECT auth_user_id INTO v_uid FROM public.students WHERE id=v_sid;
  IF v_uid IS NOT NULL THEN UPDATE public.profiles SET username=v_name WHERE id=v_uid; END IF;

  RAISE NOTICE '✓ Alle 18 Schülernamen aktualisiert.';

END;
$$;

-- Kontrolle: alle Namen der Klasse
SELECT first_name, display_name, id
FROM public.students
WHERE class_id = '1651d5b5-bc63-47c5-b70e-a25a7b73c259'
ORDER BY first_name;
