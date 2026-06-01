-- Set ends_at for the current active Schlossberg route (deadline: 15. Juni 2026, 23:59 CEST)
UPDATE public.nfc_routes
SET ends_at = '2026-06-15 21:59:59Z'   -- 23:59 CEST = UTC+2
WHERE name = 'Abenteuer Schlossberg' AND active = true;

-- Update record_nfc_scan: block scans once ends_at has passed
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

  -- 3. Zugehörige Route laden (muss aktiv und nicht abgelaufen sein)
  SELECT r.id, r.name, r.description, r.points_reward
  INTO v_route
  FROM public.nfc_routes r
  WHERE r.id = v_station.route_id
    AND r.active = true
    AND (r.ends_at IS NULL OR r.ends_at > now());

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

  -- 7. Abschluss-Prüfung
  IF v_scanned_count >= v_total_count THEN
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
