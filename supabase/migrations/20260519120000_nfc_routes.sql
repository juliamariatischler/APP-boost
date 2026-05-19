-- ============================================================
-- NFC Wochenchallenge Schema
-- ============================================================

-- Route definitions (eine Route = eine Wochenchallenge-Strecke)
CREATE TABLE IF NOT EXISTS public.nfc_routes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  description   text,
  points_reward integer NOT NULL DEFAULT 100,
  active        boolean DEFAULT true,
  week_start    date,
  created_at    timestamptz DEFAULT now()
);

-- Stations per route (jeder NFC-Chip = eine Station)
CREATE TABLE IF NOT EXISTS public.nfc_stations (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id      uuid REFERENCES public.nfc_routes(id) ON DELETE CASCADE NOT NULL,
  name          text NOT NULL,
  nfc_tag_id    text NOT NULL,        -- Text auf dem NFC-Chip, z. B. "BOOST-WALDWEG-START"
  station_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(nfc_tag_id)                  -- jeder Chip hat einen globalen Unique-Code
);

-- Scan-Fortschritt pro Kind pro Station (eine Zeile = eine erfolgreich gescannte Station)
CREATE TABLE IF NOT EXISTS public.nfc_scan_progress (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scanner_id  text NOT NULL,          -- UUID als Text (student.id oder auth user id)
  route_id    uuid REFERENCES public.nfc_routes(id) ON DELETE CASCADE NOT NULL,
  station_id  uuid REFERENCES public.nfc_stations(id) ON DELETE CASCADE NOT NULL,
  scanned_at  timestamptz DEFAULT now(),
  UNIQUE(scanner_id, route_id, station_id)   -- doppelte Scans desselben Chips zählen nicht
);

-- Abgeschlossene Routen (erst wenn ALLE Stationen gescannt)
CREATE TABLE IF NOT EXISTS public.nfc_route_completions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scanner_id     text NOT NULL,
  route_id       uuid REFERENCES public.nfc_routes(id) ON DELETE CASCADE NOT NULL,
  completed_at   timestamptz DEFAULT now(),
  points_awarded integer NOT NULL DEFAULT 0,
  UNIQUE(scanner_id, route_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_nfc_scan_progress_scanner  ON public.nfc_scan_progress(scanner_id, route_id);
CREATE INDEX IF NOT EXISTS idx_nfc_completions_scanner     ON public.nfc_route_completions(scanner_id);
CREATE INDEX IF NOT EXISTS idx_nfc_stations_tag_id         ON public.nfc_stations(nfc_tag_id);
CREATE INDEX IF NOT EXISTS idx_nfc_stations_route          ON public.nfc_stations(route_id);

-- RLS aktivieren
ALTER TABLE public.nfc_routes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_stations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_scan_progress       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_route_completions   ENABLE ROW LEVEL SECURITY;

-- Öffentliche Leseberechtigung für Routen und Stationen
DROP POLICY IF EXISTS "nfc_routes_select"   ON public.nfc_routes;
DROP POLICY IF EXISTS "nfc_stations_select" ON public.nfc_stations;
CREATE POLICY "nfc_routes_select"   ON public.nfc_routes   FOR SELECT USING (true);
CREATE POLICY "nfc_stations_select" ON public.nfc_stations FOR SELECT USING (true);

-- Scan-Fortschritt: eigene Daten lesbar (für Supabase-Auth-User)
DROP POLICY IF EXISTS "nfc_scan_progress_own"  ON public.nfc_scan_progress;
DROP POLICY IF EXISTS "nfc_completions_own"    ON public.nfc_route_completions;
CREATE POLICY "nfc_scan_progress_own"    ON public.nfc_scan_progress
  FOR SELECT USING (scanner_id = auth.uid()::text);
CREATE POLICY "nfc_completions_own"      ON public.nfc_route_completions
  FOR SELECT USING (scanner_id = auth.uid()::text);


-- ============================================================
-- RPC: record_nfc_scan
--
-- Speichert einen NFC-Scan manipulationssicher auf dem Server.
-- Unterstützt beide Auth-Systeme:
--   • Code-Auth (Schüler): p_device_id übergeben
--   • Supabase-Auth:       kein p_device_id nötig (auth.uid() wird genutzt)
--
-- Rückgabewerte:
--   status = 'scanned'          → Station registriert, Route noch offen
--   status = 'complete'         → Alle Stationen gescannt, Route abgeschlossen
--   status = 'already_complete' → Route war bereits abgeschlossen
--   status = 'duplicate'        → Diese Station wurde schon gescannt
--   error  = '...'              → Fehlermeldung
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_nfc_scan(
  p_nfc_tag_id    text,
  p_device_id     text DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scanner_id    text;
  v_is_code_auth  boolean := false;
  v_station       record;
  v_route         record;
  v_scanned_count integer;
  v_total_count   integer;
  v_is_complete   boolean;
  v_was_duplicate boolean := false;
BEGIN
  -- 1. Scanner-Identität auflösen
  IF p_device_id IS NOT NULL AND p_session_token IS NOT NULL THEN
    SELECT user_id::text INTO v_scanner_id
    FROM public.active_sessions
    WHERE device_id = p_device_id
      AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      AND active = true
      AND COALESCE(expires_at, now() + interval '1 day') > now()
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_scanner_id IS NOT NULL THEN
      v_is_code_auth := true;
    END IF;
  ELSIF p_device_id IS NOT NULL AND p_session_token IS NULL THEN
    RETURN jsonb_build_object('error', 'Nicht angemeldet. Bitte neu einloggen.');
  END IF;

  -- Fallback: Supabase-Auth
  IF v_scanner_id IS NULL AND auth.uid() IS NOT NULL THEN
    v_scanner_id := auth.uid()::text;
    v_is_code_auth := false;
  END IF;

  IF v_scanner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Nicht angemeldet. Bitte neu einloggen.');
  END IF;

  -- 2. NFC-Station anhand der Tag-ID finden
  SELECT st.id, st.route_id, st.name, st.station_order
  INTO v_station
  FROM public.nfc_stations st
  WHERE st.nfc_tag_id = upper(trim(p_nfc_tag_id));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Dieser NFC-Chip gehört zu keiner bekannten Route.');
  END IF;

  -- 3. Zugehörige Route laden (muss aktiv sein)
  SELECT r.id, r.name, r.description, r.points_reward
  INTO v_route
  FROM public.nfc_routes r
  WHERE r.id = v_station.route_id AND r.active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Diese Route ist momentan nicht aktiv.');
  END IF;

  -- 4. Prüfen ob Route bereits abgeschlossen wurde
  SELECT EXISTS(
    SELECT 1 FROM public.nfc_route_completions
    WHERE scanner_id = v_scanner_id AND route_id = v_route.id
  ) INTO v_is_complete;

  IF v_is_complete THEN
    SELECT COUNT(*) INTO v_total_count
    FROM public.nfc_stations WHERE route_id = v_route.id;

    RETURN jsonb_build_object(
      'status',        'already_complete',
      'route_name',    v_route.name,
      'station_name',  v_station.name,
      'scanned_count', v_total_count,
      'total_count',   v_total_count
    );
  END IF;

  -- 5. Prüfen ob diese Station schon gescannt wurde (Duplikat)
  SELECT EXISTS(
    SELECT 1 FROM public.nfc_scan_progress
    WHERE scanner_id = v_scanner_id
      AND route_id   = v_route.id
      AND station_id = v_station.id
  ) INTO v_was_duplicate;

  -- Scan einfügen (idempotent – doppelte Scans desselben Chips zählen nicht)
  INSERT INTO public.nfc_scan_progress (scanner_id, route_id, station_id)
  VALUES (v_scanner_id, v_route.id, v_station.id)
  ON CONFLICT (scanner_id, route_id, station_id) DO NOTHING;

  -- 6. Fortschritt zählen
  SELECT COUNT(*) INTO v_scanned_count
  FROM public.nfc_scan_progress
  WHERE scanner_id = v_scanner_id AND route_id = v_route.id;

  SELECT COUNT(*) INTO v_total_count
  FROM public.nfc_stations
  WHERE route_id = v_route.id;

  -- 7. Abschluss-Prüfung: Route nur erledigt wenn ALLE Stationen gescannt
  IF v_scanned_count >= v_total_count THEN
    -- CTE ensures points are awarded exactly once: only if the completion row is newly inserted.
    -- The ON CONFLICT DO NOTHING means concurrent calls will only produce one INSERT winner,
    -- and only that winner's CTE will match the EXISTS check on the UPDATE.
    IF v_is_code_auth THEN
      WITH ins AS (
        INSERT INTO public.nfc_route_completions (scanner_id, route_id, points_awarded)
        VALUES (v_scanner_id, v_route.id, v_route.points_reward)
        ON CONFLICT (scanner_id, route_id) DO NOTHING
        RETURNING 1
      )
      UPDATE public.students
      SET points = COALESCE(points, 0) + v_route.points_reward
      WHERE id = v_scanner_id::uuid AND EXISTS (SELECT 1 FROM ins);
    ELSE
      WITH ins AS (
        INSERT INTO public.nfc_route_completions (scanner_id, route_id, points_awarded)
        VALUES (v_scanner_id, v_route.id, v_route.points_reward)
        ON CONFLICT (scanner_id, route_id) DO NOTHING
        RETURNING 1
      )
      UPDATE public.profiles
      SET points = COALESCE(points, 0) + v_route.points_reward
      WHERE id = v_scanner_id::uuid AND EXISTS (SELECT 1 FROM ins);
    END IF;

    RETURN jsonb_build_object(
      'status',        'complete',
      'route_name',    v_route.name,
      'station_name',  v_station.name,
      'scanned_count', v_scanned_count,
      'total_count',   v_total_count,
      'points_reward', v_route.points_reward
    );
  END IF;

  RETURN jsonb_build_object(
    'status',        CASE WHEN v_was_duplicate THEN 'duplicate' ELSE 'scanned' END,
    'route_name',    v_route.name,
    'station_name',  v_station.name,
    'scanned_count', v_scanned_count,
    'total_count',   v_total_count
  );
END;
$$;


-- ============================================================
-- RPC: get_nfc_route_progress
-- Gibt den aktuellen Fortschritt eines Scanners für eine Route zurück
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_nfc_route_progress(
  p_route_id      uuid,
  p_device_id     text DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scanner_id         text;
  v_scanned_count      integer;
  v_total_count        integer;
  v_is_complete        boolean;
  v_scanned_station_ids text[];
BEGIN
  -- Scanner auflösen
  IF p_device_id IS NOT NULL AND p_session_token IS NOT NULL THEN
    SELECT user_id::text INTO v_scanner_id
    FROM public.active_sessions
    WHERE device_id = p_device_id
      AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      AND active = true
      AND COALESCE(expires_at, now() + interval '1 day') > now()
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_scanner_id IS NULL AND auth.uid() IS NOT NULL THEN
    v_scanner_id := auth.uid()::text;
  END IF;

  -- Kein Scanner: leeren Fortschritt zurückgeben
  IF v_scanner_id IS NULL THEN
    SELECT COUNT(*) INTO v_total_count FROM public.nfc_stations WHERE route_id = p_route_id;
    RETURN jsonb_build_object(
      'scanned_count',       0,
      'total_count',         v_total_count,
      'is_complete',         false,
      'scanned_station_ids', '[]'::jsonb
    );
  END IF;

  SELECT COUNT(*) INTO v_total_count
  FROM public.nfc_stations WHERE route_id = p_route_id;

  SELECT COUNT(*) INTO v_scanned_count
  FROM public.nfc_scan_progress
  WHERE scanner_id = v_scanner_id AND route_id = p_route_id;

  SELECT array_agg(station_id::text) INTO v_scanned_station_ids
  FROM public.nfc_scan_progress
  WHERE scanner_id = v_scanner_id AND route_id = p_route_id;

  SELECT EXISTS(
    SELECT 1 FROM public.nfc_route_completions
    WHERE scanner_id = v_scanner_id AND route_id = p_route_id
  ) INTO v_is_complete;

  RETURN jsonb_build_object(
    'scanned_count',      v_scanned_count,
    'total_count',        v_total_count,
    'is_complete',        v_is_complete,
    'scanned_station_ids', COALESCE(to_jsonb(v_scanned_station_ids), '[]'::jsonb)
  );
END;
$$;

-- Grants: anon + authenticated (code-auth students call as anon, Supabase-auth as authenticated)
GRANT EXECUTE ON FUNCTION public.record_nfc_scan(text, text, text)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_nfc_route_progress(uuid, text, text) TO anon, authenticated;


-- ============================================================
-- Seed: Beispiel-Route "Waldweg" (idempotent)
-- ============================================================
DO $$
DECLARE
  v_route_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.nfc_routes WHERE name = 'Wochenchallenge Waldweg') THEN
    INSERT INTO public.nfc_routes (name, description, points_reward, active, week_start)
    VALUES (
      'Wochenchallenge Waldweg',
      'Laufe den kompletten Waldweg und scanne alle 3 NFC-Stationen: Start, Mitte und Ziel!',
      100,
      true,
      CURRENT_DATE
    )
    RETURNING id INTO v_route_id;

    INSERT INTO public.nfc_stations (route_id, name, nfc_tag_id, station_order) VALUES
      (v_route_id, 'Start', 'BOOST-WALDWEG-START', 1),
      (v_route_id, 'Mitte', 'BOOST-WALDWEG-MITTE', 2),
      (v_route_id, 'Ziel',  'BOOST-WALDWEG-ZIEL',  3);
  END IF;
END;
$$;
