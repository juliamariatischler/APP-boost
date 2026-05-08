-- ============================================================
-- NMS Straden – Neue Schüler/innen + Übungsdaten
-- Führe dieses Script im Supabase SQL Editor aus.
-- ============================================================

DO $$
DECLARE
  v_class_id   uuid;
  v_max_id     uuid := gen_random_uuid();
  v_stefanie_id uuid := gen_random_uuid();
  v_susi_id    uuid := gen_random_uuid();
  v_marie_id   uuid := gen_random_uuid();
BEGIN

  -- ── 1. Klasse ermitteln ──────────────────────────────────
  SELECT c.id INTO v_class_id
  FROM public.classes c
  JOIN public.schools s ON s.id = c.school_id
  WHERE s.name ILIKE '%Straden%'
  ORDER BY c.created_at
  LIMIT 1;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Klasse für NMS Straden nicht gefunden. Bitte zuerst die Schule/Klasse anlegen.';
  END IF;

  RAISE NOTICE 'Verwende class_id: %', v_class_id;

  -- ── 2. FK-Constraint auf daily_results temporär entfernen ──
  -- Die App nutzt public.students.id als user_id in daily_results.
  -- Der ursprüngliche FK zeigt auf public.profiles (Auth-User).
  -- Für code-auth Schüler muss dieser FK entfernt werden.
  ALTER TABLE public.daily_results
    DROP CONSTRAINT IF EXISTS daily_results_user_id_fkey;

  -- ── 3. Schüler/innen anlegen ─────────────────────────────
  INSERT INTO public.students
    (id, class_id, first_name, display_name, login_code, active,
     activation_code_hash, activation_code_created_at)
  VALUES
    (v_max_id,      v_class_id, 'Max',      'Max',      'QR-' || encode(gen_random_bytes(16), 'hex'), true,
     encode(digest(upper(trim('MAX-ACTIVATE-001')),  'sha256'), 'hex'), now()),
    (v_stefanie_id, v_class_id, 'Stefanie', 'Stefanie', 'QR-' || encode(gen_random_bytes(16), 'hex'), true,
     encode(digest(upper(trim('STE-ACTIVATE-002')),  'sha256'), 'hex'), now()),
    (v_susi_id,     v_class_id, 'Susi',     'Susi',     'QR-' || encode(gen_random_bytes(16), 'hex'), true,
     encode(digest(upper(trim('SUS-ACTIVATE-003')),  'sha256'), 'hex'), now()),
    (v_marie_id,    v_class_id, 'Marie',    'Marie',    'QR-' || encode(gen_random_bytes(16), 'hex'), true,
     encode(digest(upper(trim('MAR-ACTIVATE-004')),  'sha256'), 'hex'), now())
  ON CONFLICT (login_code) DO NOTHING;

  RAISE NOTICE 'Schüler/innen angelegt: Max=%, Stefanie=%, Susi=%, Marie=%',
    v_max_id, v_stefanie_id, v_susi_id, v_marie_id;

  -- ── 4. Übungsdaten für KW 19 (Mo 04.05. – Fr 08.05.2026) ─
  -- Ziele: push_ups 10, squats 10, planks 10, sit_ups 25, jumping_jacks 40, steps 3000
  -- steps_tracking_active = true bedeutet: Schritte wurden heute gezählt

  INSERT INTO public.daily_results
    (user_id, date, push_ups, squats, planks, sit_ups, jumping_jacks, steps, steps_tracking_active)
  VALUES
    -- MAX: Mo–Do vollständig, Fr noch nichts
    (v_max_id, '2026-05-04', 10, 10, 10, 25, 40, 4200, true),
    (v_max_id, '2026-05-05', 10, 10, 10, 25, 40, 3800, true),
    (v_max_id, '2026-05-06', 10, 10, 10, 25, 40, 5100, true),
    (v_max_id, '2026-05-07', 10, 10, 10, 25, 40, 3200, true),

    -- STEFANIE: Mo–Mi vollständig, Do teilweise, Fr vollständig
    (v_stefanie_id, '2026-05-04', 10, 10, 10, 25, 40, 3500, true),
    (v_stefanie_id, '2026-05-05', 10, 10, 10, 25, 40, 4000, true),
    (v_stefanie_id, '2026-05-06', 10, 10, 10, 25, 40, 3900, true),
    (v_stefanie_id, '2026-05-07',  5,  8,  0, 15, 20,    0, false),
    (v_stefanie_id, '2026-05-08', 10, 10, 10, 25, 40, 4100, true),

    -- SUSI: alle 5 Tage vollständig (fleißigste!)
    (v_susi_id, '2026-05-04', 10, 10, 10, 25, 40, 6200, true),
    (v_susi_id, '2026-05-05', 10, 10, 10, 25, 40, 5800, true),
    (v_susi_id, '2026-05-06', 10, 10, 10, 25, 40, 7000, true),
    (v_susi_id, '2026-05-07', 10, 10, 10, 25, 40, 5500, true),
    (v_susi_id, '2026-05-08', 10, 10, 10, 25, 40, 4800, true),

    -- MARIE: Mo–Di, dann Do–Fr (Mi gefehlt)
    (v_marie_id, '2026-05-04', 10, 10, 10, 25, 40, 3100, true),
    (v_marie_id, '2026-05-05', 10, 10, 10, 25, 40, 2900, true),
    (v_marie_id, '2026-05-07', 10, 10, 10, 25, 40, 3600, true),
    (v_marie_id, '2026-05-08',  8,  6, 10, 20, 30,    0, false)

  ON CONFLICT (user_id, date) DO NOTHING;

  RAISE NOTICE 'Übungsdaten eingefügt.';

END;
$$;

-- ── Ergebnis prüfen ──────────────────────────────────────────
SELECT
  s.display_name,
  dr.date,
  dr.push_ups, dr.squats, dr.planks, dr.sit_ups, dr.jumping_jacks,
  dr.steps, dr.steps_tracking_active
FROM public.students s
JOIN public.daily_results dr ON dr.user_id = s.id
WHERE s.first_name IN ('Max', 'Stefanie', 'Susi', 'Marie')
ORDER BY s.display_name, dr.date;
