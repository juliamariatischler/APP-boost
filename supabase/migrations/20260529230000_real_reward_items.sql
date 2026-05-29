-- Replace placeholder reward items with the real sponsor data

-- Deactivate all old placeholder items (incl. Sport-Trinkflasche)
UPDATE public.reward_items
SET is_active = false, updated_at = now()
WHERE lower(title) IN (
  'bipa gutschein 5eur',
  'dm gutschein 5eur',
  'dm gutschein 20eur',
  'nike socken',
  'spar gutschein 10eur',
  'fitness-armband',
  'sport-rucksack',
  'sport-trinkflasche'
);

-- Insert new real reward items (skip if title already exists)
INSERT INTO public.reward_items (title, partner, threshold, category, icon, is_active)
SELECT v.title, v.partner, v.threshold, v.category, v.icon, true
FROM (VALUES
  ('Thieme Gutschein 10EUR',    'Thieme',     600,  'gutscheine', '📖'),
  ('Frisbeescheibe',            'Murpark',   750,  'sport',      '🥏'),
  ('Sport Gutschein',           'Sport 2000', 900,  'gutscheine', '🎫'),
  ('Thieme Gutschein 20EUR',    'Thieme',     1000, 'gutscheine', '📖'),
  ('Ping-Pong-Set',             'Murpark',   1200, 'sport',      '🏓'),
  ('Sport2000 Gutschein 20EUR', 'Sport 2000', 1500, 'gutscheine', '🎫')
) AS v(title, partner, threshold, category, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reward_items r
  WHERE lower(r.title) = lower(v.title)
);
