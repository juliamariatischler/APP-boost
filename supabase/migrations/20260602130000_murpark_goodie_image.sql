-- Add Murpark Goodie Sackerl image for Platz 21–29
UPDATE public.reward_items
SET image_url = 'https://srzhxzwxtrcotfhffhww.supabase.co/storage/v1/object/public/assets/ChatGPT%20Image%202.%20Juni%202026,%2019_06_51.png',
    updated_at = now()
WHERE partner = 'Murpark'
  AND is_active = true;
