-- Guardian phone verification for Try It sessions
CREATE TABLE IF NOT EXISTS guardian_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES trial_sessions(id) ON DELETE CASCADE NOT NULL,
  guardian_phone TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE guardian_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own guardian verifications" ON guardian_verifications;
CREATE POLICY "Users can read own guardian verifications"
  ON guardian_verifications FOR SELECT
  USING (auth.uid() = user_id);

ALTER TABLE trial_registrations
  ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
