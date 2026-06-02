-- Add product images for JBL prizes (Platz 1–5)
UPDATE public.reward_items
SET image_url = 'https://srzhxzwxtrcotfhffhww.supabase.co/storage/v1/object/public/assets/ASSET_MMS_138007734.jpeg',
    updated_at = now()
WHERE partner = 'Raiffeisen'
  AND title LIKE 'JBL Box GO 4%'
  AND is_active = true;

UPDATE public.reward_items
SET image_url = 'https://srzhxzwxtrcotfhffhww.supabase.co/storage/v1/object/public/assets/1.JBL_Wave_Vibe_%20Buds_Product%20Image_Hero_Black.png',
    updated_at = now()
WHERE partner = 'Raiffeisen'
  AND title LIKE 'JBL Wave 100%'
  AND is_active = true;
