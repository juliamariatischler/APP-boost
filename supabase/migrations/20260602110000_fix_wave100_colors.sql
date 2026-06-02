-- Differentiate JBL Wave 100 TW by color (white = Platz 4, black = Platz 5)
UPDATE public.reward_items
SET title = 'JBL Wave 100 TW, weiß',  icon = '🎧', updated_at = now()
WHERE title = 'JBL Wave 100' AND threshold = 2600 AND is_active = true;

UPDATE public.reward_items
SET title = 'JBL Wave 100 TW, schwarz', icon = '🎧', updated_at = now()
WHERE title = 'JBL Wave 100' AND threshold = 2500 AND is_active = true;
