-- Add Cineplexx popcorn image for Platz 11–15
UPDATE public.reward_items
SET image_url = 'https://srzhxzwxtrcotfhffhww.supabase.co/storage/v1/object/public/assets/673ca59b6f61802ef64bc57bba7cf885.png',
    updated_at = now()
WHERE partner = 'Cineplexx'
  AND is_active = true;

-- Remove Platz 27–29 (threshold 100–300, Murpark small items)
UPDATE public.reward_items
SET is_active = false, updated_at = now()
WHERE partner = 'Murpark'
  AND threshold BETWEEN 100 AND 300
  AND is_active = true;
