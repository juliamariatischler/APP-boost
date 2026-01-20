-- Tabelle für Vereine/Clubs
CREATE TABLE public.clubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sport_type TEXT NOT NULL,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabelle für Schnuppertermine
CREATE TABLE public.trial_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location TEXT NOT NULL,
  address TEXT,
  max_participants INTEGER NOT NULL DEFAULT 10,
  min_age INTEGER,
  max_age INTEGER,
  requirements TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabelle für Anmeldungen zu Schnupperterminen
CREATE TABLE public.trial_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.trial_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled', 'attended')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_registrations ENABLE ROW LEVEL SECURITY;

-- Clubs sind öffentlich lesbar (alle können Vereine sehen)
CREATE POLICY "Anyone can view clubs"
  ON public.clubs FOR SELECT
  USING (true);

-- Nur Admins können Clubs verwalten
CREATE POLICY "Admins can manage clubs"
  ON public.clubs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trial Sessions sind öffentlich lesbar
CREATE POLICY "Anyone can view trial sessions"
  ON public.trial_sessions FOR SELECT
  USING (true);

-- Nur Admins können Sessions verwalten
CREATE POLICY "Admins can manage trial sessions"
  ON public.trial_sessions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User können ihre eigenen Anmeldungen sehen
CREATE POLICY "Users can view their own registrations"
  ON public.trial_registrations FOR SELECT
  USING (auth.uid() = user_id);

-- Admins können alle Anmeldungen sehen
CREATE POLICY "Admins can view all registrations"
  ON public.trial_registrations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- User können sich selbst anmelden
CREATE POLICY "Users can register themselves"
  ON public.trial_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User können ihre eigene Anmeldung aktualisieren (z.B. stornieren)
CREATE POLICY "Users can update their own registrations"
  ON public.trial_registrations FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins können alle Anmeldungen verwalten
CREATE POLICY "Admins can manage all registrations"
  ON public.trial_registrations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger für updated_at
CREATE TRIGGER update_clubs_updated_at
  BEFORE UPDATE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trial_sessions_updated_at
  BEFORE UPDATE ON public.trial_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trial_registrations_updated_at
  BEFORE UPDATE ON public.trial_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();