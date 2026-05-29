-- Remove all Gutschein reward items (Platz 1, 3, 4, 6 in current ranking)
-- Sport2000 Gutschein 20EUR, Thieme Gutschein 20EUR, Sport Gutschein, Thieme Gutschein 10EUR

UPDATE public.reward_items
SET    is_active = false, updated_at = now()
WHERE  is_active = true
  AND  lower(title) LIKE '%gutschein%';
