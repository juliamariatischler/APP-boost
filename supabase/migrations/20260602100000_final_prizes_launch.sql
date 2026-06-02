-- Final prizes for BOOST launch 2026-06-02
-- 29 prizes across 29 ranks (Platz 1–29)
-- threshold = (30 - rank) * 100  →  Platz 1 = 2900, Platz 29 = 100

-- ── Deactivate all currently active reward items ──────────────────────────────
UPDATE public.reward_items
SET    is_active = false, updated_at = now()
WHERE  is_active = true;

-- ── Insert 29 final prizes ────────────────────────────────────────────────────
-- Raiffeisen (Platz 1–5)
INSERT INTO public.reward_items (title, partner, threshold, category, icon, is_active) VALUES
  ('JBL Box GO 4, blau',  'Raiffeisen', 2900, 'elektronik', '🔵', true),
  ('JBL Box GO 4, blau',  'Raiffeisen', 2800, 'elektronik', '🔵', true),
  ('JBL Box GO 4, weiß',  'Raiffeisen', 2700, 'elektronik', '⚪', true),
  ('JBL Wave 100',        'Raiffeisen', 2600, 'elektronik', '🎧', true),
  ('JBL Wave 100',        'Raiffeisen', 2500, 'elektronik', '🎧', true),

-- Sport 2000 DIV (Platz 6–10)
  ('Sport 2000 Sachspende', 'Sport 2000', 2400, 'sport', '🏅', true),
  ('Sport 2000 Sachspende', 'Sport 2000', 2300, 'sport', '🏅', true),
  ('Sport 2000 Sachspende', 'Sport 2000', 2200, 'sport', '🏅', true),
  ('Sport 2000 Sachspende', 'Sport 2000', 2100, 'sport', '🏅', true),
  ('Sport 2000 Sachspende', 'Sport 2000', 2000, 'sport', '🏅', true),

-- Cineplexx (Platz 11–15)
  ('2x Popcorngutschein', 'Cineplexx', 1900, 'gutscheine', '🎬', true),
  ('2x Popcorngutschein', 'Cineplexx', 1800, 'gutscheine', '🎬', true),
  ('2x Popcorngutschein', 'Cineplexx', 1700, 'gutscheine', '🎬', true),
  ('2x Popcorngutschein', 'Cineplexx', 1600, 'gutscheine', '🎬', true),
  ('2x Popcorngutschein', 'Cineplexx', 1500, 'gutscheine', '🎬', true),

-- Sport 2000 DIV (Platz 16–20)
  ('Sport 2000 Sachspende', 'Sport 2000', 1400, 'sport', '🏅', true),
  ('Sport 2000 Sachspende', 'Sport 2000', 1300, 'sport', '🏅', true),
  ('Sport 2000 Sachspende', 'Sport 2000', 1200, 'sport', '🏅', true),
  ('Sport 2000 Sachspende', 'Sport 2000', 1100, 'sport', '🏅', true),
  ('Sport 2000 Sachspende', 'Sport 2000', 1000, 'sport', '🏅', true),

-- Murpark (Platz 21–29)
  ('Frisbee',           'Murpark', 900, 'sport',   '🥏', true),
  ('Beachball-Set',     'Murpark', 800, 'sport',   '⚽', true),
  ('Stofftasche',       'Murpark', 700, 'taschen', '👜', true),
  ('Notizbuch',         'Murpark', 600, 'kreativ', '📓', true),
  ('Buntstift-Set',     'Murpark', 500, 'kreativ', '🖍️', true),
  ('Malset',            'Murpark', 400, 'kreativ', '🎨', true),
  ('Taschenspiegel',    'Murpark', 300, 'style',   '🪞', true),
  ('Brillenputztuch',   'Murpark', 200, 'style',   '👓', true),
  ('Taschentücher-Box', 'Murpark', 100, 'style',   '🤧', true);
