-- Ersetze Dummy-Telefonnummern in den Seed-Clubs durch realistische österreichische Nummern

UPDATE public.clubs SET contact_phone = '+43 316 512 345' WHERE id = 'a1000000-0000-0000-0000-000000000001'; -- SK Sturm Graz Jugend
UPDATE public.clubs SET contact_phone = '+43 650 580 9058' WHERE id = 'a1000000-0000-0000-0000-000000000002'; -- Badminton Club Graz
UPDATE public.clubs SET contact_phone = '+43 316 734 567' WHERE id = 'a1000000-0000-0000-0000-000000000003'; -- Schwimmclub Graz
UPDATE public.clubs SET contact_phone = '+43 664 505 5554' WHERE id = 'a1000000-0000-0000-0000-000000000004'; -- Basket Flames Graz
UPDATE public.clubs SET contact_phone = '+43 316 823 456' WHERE id = 'a1000000-0000-0000-0000-000000000005'; -- Tennisclub Liebenau
