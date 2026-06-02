-- Platz 21–26: title = "Goodie Bag", image already set
UPDATE public.reward_items
SET title = 'Goodie Bag',
    updated_at = now()
WHERE partner = 'Murpark'
  AND threshold BETWEEN 400 AND 900
  AND is_active = true;
