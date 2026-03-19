CREATE TABLE IF NOT EXISTS public.presentation_class_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school text NOT NULL,
  class text NOT NULL,
  total_flashes integer NOT NULL,
  student_count integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school, class)
);

ALTER TABLE public.presentation_class_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read presentation class rankings" ON public.presentation_class_rankings;
CREATE POLICY "Authenticated users can read presentation class rankings"
  ON public.presentation_class_rankings
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage presentation class rankings" ON public.presentation_class_rankings;
CREATE POLICY "Admins manage presentation class rankings"
  ON public.presentation_class_rankings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_presentation_class_rankings_updated_at ON public.presentation_class_rankings;
CREATE TRIGGER update_presentation_class_rankings_updated_at
  BEFORE UPDATE ON public.presentation_class_rankings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.presentation_class_rankings (school, class, total_flashes, student_count, sort_order)
VALUES
  ('NMS Klusemann', '3b', 2840, 30, 1),
  ('NMS Straden', '4a', 2635, 30, 2),
  ('Ursulinen', '3e', 2410, 30, 3),
  ('NMS Graz St. Peter', '3c', 2195, 30, 4),
  ('MS Graz Smart City', '2a', 1980, 30, 5)
ON CONFLICT (school, class) DO UPDATE
SET total_flashes = EXCLUDED.total_flashes,
    student_count = EXCLUDED.student_count,
    is_active = true,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
