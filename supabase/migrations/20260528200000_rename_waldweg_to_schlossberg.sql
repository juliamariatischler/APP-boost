-- Rename Waldweg route to Schlossberg adventure (child-friendly)
UPDATE public.nfc_routes
SET
  name        = 'Abenteuer Schlossberg',
  description = 'Erkunde den Schlossberg in Graz und finde alle 3 geheimen NFC-Chips! Kannst du alle aufspüren?'
WHERE name = 'Wochenchallenge Waldweg';

-- Update station names and simplify NFC tag IDs (no route name in chip code)
UPDATE public.nfc_stations
SET name = 'Eingang', nfc_tag_id = 'BOOST-START'
WHERE nfc_tag_id = 'BOOST-WALDWEG-START';

UPDATE public.nfc_stations
SET name = 'Gipfel', nfc_tag_id = 'BOOST-MITTE'
WHERE nfc_tag_id = 'BOOST-WALDWEG-MITTE';

UPDATE public.nfc_stations
SET nfc_tag_id = 'BOOST-ZIEL'
WHERE nfc_tag_id = 'BOOST-WALDWEG-ZIEL';
