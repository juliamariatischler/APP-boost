CREATE TABLE IF NOT EXISTS public.station_scans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id text NOT NULL,
  station_id text NOT NULL,
  scanned_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, challenge_id, station_id)
);

ALTER TABLE public.station_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own scans" ON public.station_scans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own scans" ON public.station_scans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX ON public.station_scans(user_id, challenge_id);
