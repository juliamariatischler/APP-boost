-- Fix image URLs to match actual filenames in Supabase Storage
UPDATE public.reward_items
SET image_url = 'https://srzhxzwxtrcotfhffhww.supabase.co/storage/v1/object/public/assets/JBL%20Box.jpeg',
    updated_at = now()
WHERE partner = 'Raiffeisen' AND title LIKE 'JBL Box GO 4%' AND is_active = true;

UPDATE public.reward_items
SET image_url = 'https://srzhxzwxtrcotfhffhww.supabase.co/storage/v1/object/public/assets/1.JBL_Wave_Vibe_%20Buds_Product%20Image_Hero_Black.png',
    updated_at = now()
WHERE partner = 'Raiffeisen' AND title LIKE 'JBL Wave 100%' AND is_active = true;

UPDATE public.reward_items
SET image_url = 'https://srzhxzwxtrcotfhffhww.supabase.co/storage/v1/object/public/assets/Popcorn%20GS.png',
    updated_at = now()
WHERE partner = 'Cineplexx' AND is_active = true;

UPDATE public.reward_items
SET image_url = 'https://srzhxzwxtrcotfhffhww.supabase.co/storage/v1/object/public/assets/Geschenk%20Murpark.png',
    updated_at = now()
WHERE partner = 'Murpark' AND is_active = true;
