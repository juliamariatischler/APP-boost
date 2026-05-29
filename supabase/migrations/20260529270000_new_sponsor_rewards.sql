-- Replace old rewards with real Murpark Sachspenden (from product photo)
-- + Klassenpausenset as class milestone
-- + Fix anon (code-login students) access to reward_items and class_milestones

-- ── Anon access fix ──────────────────────────────────────────────────────────
-- Code-login students use the anon Supabase client; without these grants/policies
-- they silently fall back to hardcoded fallback data instead of DB content.

GRANT SELECT ON TABLE public.reward_items    TO anon;
GRANT SELECT ON TABLE public.class_milestones TO anon;

DROP POLICY IF EXISTS "Anon users can read reward items"      ON public.reward_items;
CREATE POLICY "Anon users can read reward items"
  ON public.reward_items FOR SELECT TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Anon users can read class milestones"  ON public.class_milestones;
CREATE POLICY "Anon users can read class milestones"
  ON public.class_milestones FOR SELECT TO anon
  USING (is_active = true);

-- ── Deactivate all old reward items ─────────────────────────────────────────
UPDATE public.reward_items
SET    is_active = false, updated_at = now()
WHERE  is_active = true;

-- ── New Murpark Sachspenden (from product photo) ────────────────────────────
-- threshold is used only for rank ordering (DESC → Platz 1 = highest value)
-- Higher threshold = more valuable prize = lower rank number shown in app
INSERT INTO public.reward_items (title, partner, threshold, category, icon, is_active)
VALUES
  ('Stofftasche groß',   'Murpark', 800, 'taschen', '👜', true),
  ('Beachtennis-Set',    'Murpark', 700, 'sport',   '🏓', true),
  ('Frisbee',            'Murpark', 600, 'sport',   '🥏', true),
  ('Notizbuch',          'Murpark', 500, 'kreativ', '📓', true),
  ('Stoffbeutel',        'Murpark', 400, 'taschen', '🛍️', true),
  ('Kompaktspiegel',     'Murpark', 300, 'style',   '🪞', true),
  ('Buntstifte',         'Murpark', 200, 'kreativ', '🖍️', true),
  ('Malset',             'Murpark', 100, 'kreativ', '🎨', true);

-- ── Class milestones ─────────────────────────────────────────────────────────
-- Deactivate all old milestones and replace with Klassenpausenset
UPDATE public.class_milestones
SET    is_active = false, updated_at = now()
WHERE  is_active = true;

INSERT INTO public.class_milestones (threshold, title, description, icon, sort_order, is_active)
VALUES
  (3000, 'Klassenpausenset',
   'Sportgeräte und Spielmaterial für die Pause – für eure ganze Klasse!',
   '🏃', 1, true);
