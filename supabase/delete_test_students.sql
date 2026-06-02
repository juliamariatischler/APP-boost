-- ============================================================
-- Löscht nur die 5 sichtbaren Test-Schüler aus BoostSchule / 4A
-- In Supabase Studio → SQL Editor ausführen
-- ============================================================

-- Schritt 1: students-Tabelle (5 Einträge aus BoostSchule/4A)
DELETE FROM public.students
WHERE id IN (
  'e77ad9e1-e67a-4516-88a2-3269cabaae2d',  -- Anna
  'b9f85fe2-2192-4120-b8f9-96f03697fb0e',  -- Laura
  'd3b15760-c3bd-4182-87d7-e455f290454c',  -- Lena
  'f6ceef0f-ca9a-45a6-9795-dbffdf57ee87',  -- Lisa
  'b51b621c-ca8a-4fb9-98b8-e20e75c84062'   -- Rafaela
);

-- Schritt 2: auth.users für aktivierte Schüler (Lena, Lisa, Rafaela)
-- cascaded → löscht profiles automatisch
DELETE FROM auth.users
WHERE id IN (
  '5f3a2c93-ef6f-46cd-bd17-fb5573cecf56',  -- Lena
  '4d6c3802-a388-4b08-a721-ee1822c1d504',  -- Lisa
  'a81ec25d-118c-4a47-a0d0-7f6f6b193c05'   -- Rafaela
);

-- Kontrolle: sollte 0 zurückgeben
SELECT count(*) AS verbleibende_eintraege
FROM public.students
WHERE id IN (
  'e77ad9e1-e67a-4516-88a2-3269cabaae2d',
  'b9f85fe2-2192-4120-b8f9-96f03697fb0e',
  'd3b15760-c3bd-4182-87d7-e455f290454c',
  'f6ceef0f-ca9a-45a6-9795-dbffdf57ee87',
  'b51b621c-ca8a-4fb9-98b8-e20e75c84062'
);
