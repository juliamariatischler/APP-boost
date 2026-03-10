-- Live rewards data model + class points RPC

CREATE TABLE IF NOT EXISTS public.reward_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  partner text,
  threshold integer NOT NULL CHECK (threshold > 0),
  category text NOT NULL,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold integer NOT NULL CHECK (threshold > 0),
  title text NOT NULL,
  description text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.reward_items(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_reward_items_active_threshold
  ON public.reward_items (is_active, threshold);

CREATE INDEX IF NOT EXISTS idx_class_milestones_active_sort
  ON public.class_milestones (is_active, sort_order, threshold);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_status
  ON public.reward_redemptions (user_id, status, requested_at DESC);

ALTER TABLE public.reward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read reward items" ON public.reward_items;
CREATE POLICY "Authenticated users can read reward items"
  ON public.reward_items
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage reward items" ON public.reward_items;
CREATE POLICY "Admins manage reward items"
  ON public.reward_items
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read class milestones" ON public.class_milestones;
CREATE POLICY "Authenticated users can read class milestones"
  ON public.class_milestones
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage class milestones" ON public.class_milestones;
CREATE POLICY "Admins manage class milestones"
  ON public.class_milestones
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can read own reward redemptions" ON public.reward_redemptions;
CREATE POLICY "Users can read own reward redemptions"
  ON public.reward_redemptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can create own reward redemptions" ON public.reward_redemptions;
CREATE POLICY "Users can create own reward redemptions"
  ON public.reward_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update reward redemptions" ON public.reward_redemptions;
CREATE POLICY "Admins update reward redemptions"
  ON public.reward_redemptions
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_class_total_points(p_school text, p_class text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::integer
  FROM public.profiles
  WHERE school = p_school
    AND class = p_class;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_total_points(text, text) TO authenticated;

-- Seed defaults (safe upsert pattern by natural key)
INSERT INTO public.reward_items (title, partner, threshold, category, icon)
SELECT *
FROM (VALUES
  ('BIPA Gutschein 5EUR', 'BIPA', 50, 'gutscheine', '🎀'),
  ('dm Gutschein 5EUR', 'dm', 75, 'gutscheine', '🧴'),
  ('Sport-Trinkflasche', 'Intersport', 100, 'sport', '🍶'),
  ('Nike Socken', 'Nike', 150, 'sport', '🧦'),
  ('SPAR Gutschein 10EUR', 'SPAR', 200, 'gutscheine', '🛒'),
  ('Fitness-Armband', 'Gigasport', 300, 'zubehoer', '⌚'),
  ('Sport-Rucksack', 'Intersport', 400, 'sport', '🎒'),
  ('dm Gutschein 20EUR', 'dm', 500, 'gutscheine', '🧴')
) AS v(title, partner, threshold, category, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reward_items r
  WHERE lower(r.title) = lower(v.title)
);

INSERT INTO public.class_milestones (threshold, title, description, icon, sort_order)
SELECT *
FROM (VALUES
  (2500, 'Klassen-Equipment', 'Baelle, Seile und mehr fuer eure Klasse', '⚽', 1),
  (4000, 'Klassen-Event', 'Ein besonderes Sport-Event fuer eure Klasse', '🎉', 2),
  (6000, 'Partner-Paket', 'Grosses Ueberraschungspaket von unseren Partnern', '🎁', 3),
  (10000, 'Klassen-Ausflug', 'Ein sportlicher Tagesausflug fuer die ganze Klasse', '🚌', 4)
) AS v(threshold, title, description, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.class_milestones m
  WHERE m.threshold = v.threshold
);
