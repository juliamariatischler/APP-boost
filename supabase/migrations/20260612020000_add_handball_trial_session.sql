-- Add HIB Handball with a fixed trial session on 15.06.2026
-- Anmeldung final über Telefonnummer (siehe contact_phone)

INSERT INTO public.clubs (id, name, sport_type, description, contact_email, contact_phone, website)
VALUES (
  'a1000000-0000-0000-0000-000000000007',
  'HIB Handball',
  'Handball',
  'Schnuppertraining beim HIB Handball – Spiel, Spaß und Teamgeist. Keine Vorkenntnisse nötig.',
  'georg.rothenburger@asvoe.at',
  '0664/2848406',
  NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trial_sessions (id, club_id, title, description, date, start_time, end_time, location, address, max_participants, min_age, max_age, requirements)
VALUES (
  'b1000000-0000-0000-0000-000000000007',
  'a1000000-0000-0000-0000-000000000007',
  'Handball Schnuppertraining',
  'Komm vorbei und probiere Handball aus! Keine Vorkenntnisse nötig.',
  '2026-06-15',
  '18:00:00',
  NULL,
  'ASVÖ-Halle',
  NULL,
  20,
  NULL,
  NULL,
  'Sportkleidung und Hallenschuhe mitbringen. Kontaktperson: Georg Rothenburger, Tel. 0664/2848406. Finale Anmeldung über die Telefonnummer.'
)
ON CONFLICT (id) DO NOTHING;
