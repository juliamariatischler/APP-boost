-- Platz 21–26 (threshold 900–400): Murpark prizes get "5x" prefix
UPDATE public.reward_items SET title = '5x Frisbee',       updated_at = now() WHERE partner = 'Murpark' AND threshold = 900 AND is_active = true;
UPDATE public.reward_items SET title = '5x Beachball-Set', updated_at = now() WHERE partner = 'Murpark' AND threshold = 800 AND is_active = true;
UPDATE public.reward_items SET title = '5x Stofftasche',   updated_at = now() WHERE partner = 'Murpark' AND threshold = 700 AND is_active = true;
UPDATE public.reward_items SET title = '5x Notizbuch',     updated_at = now() WHERE partner = 'Murpark' AND threshold = 600 AND is_active = true;
UPDATE public.reward_items SET title = '5x Buntstift-Set', updated_at = now() WHERE partner = 'Murpark' AND threshold = 500 AND is_active = true;
UPDATE public.reward_items SET title = '5x Malset',        updated_at = now() WHERE partner = 'Murpark' AND threshold = 400 AND is_active = true;
