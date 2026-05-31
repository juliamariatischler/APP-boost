-- ============================================================
-- Extend NFC route tables with media and coordinate columns
-- Allows routes and stations to be fully managed from the DB
-- without app updates.
-- ============================================================

-- nfc_routes: add map image and optional end date
ALTER TABLE public.nfc_routes
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS ends_at   timestamptz;

-- nfc_stations: add description, GPS coordinates, maps link, and station image
ALTER TABLE public.nfc_stations
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS latitude        double precision,
  ADD COLUMN IF NOT EXISTS longitude       double precision,
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS image_url       text;

-- Backfill the existing Schlossberg route with coordinates
DO $$
DECLARE
  v_route_id uuid;
BEGIN
  SELECT id INTO v_route_id
  FROM public.nfc_routes
  WHERE name = 'Abenteuer Schlossberg'
  LIMIT 1;

  IF v_route_id IS NOT NULL THEN
    -- Station 1: Eingang (Schlossbergplatz / Naturfreunde)
    UPDATE public.nfc_stations
    SET
      latitude        = 47.0734192,
      longitude       = 15.4369564,
      google_maps_url = 'https://www.google.com/maps/search/?api=1&query=47.0734192,15.4369564'
    WHERE route_id = v_route_id AND station_order = 1;

    -- Station 2: Gipfel (Türkenbrunnen-Bereich)
    UPDATE public.nfc_stations
    SET
      latitude        = 47.0745041,
      longitude       = 15.4368089,
      google_maps_url = 'https://www.google.com/maps/search/?api=1&query=47.0745041,15.4368089'
    WHERE route_id = v_route_id AND station_order = 2;

    -- Station 3: Ziel (Schlossberg Süd / Uhrturm)
    UPDATE public.nfc_stations
    SET
      latitude        = 47.0735096,
      longitude       = 15.4370989,
      google_maps_url = 'https://www.google.com/maps/search/?api=1&query=47.0735096,15.4370989'
    WHERE route_id = v_route_id AND station_order = 3;
  END IF;
END;
$$;
