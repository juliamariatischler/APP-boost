-- Add Footvolley Austria / Futvolei Club Graz with a fixed trial session on 25.06.2026

INSERT INTO public.clubs (id, name, sport_type, description, contact_email, contact_phone, website)
VALUES (
  'a1000000-0000-0000-0000-000000000006',
  'Footvolley Austria / Futvolei Club Graz',
  'Footvolley',
  'Schnuppertraining in der faszinierenden Kombination aus Fußball und Volleyball.',
  NULL,
  '0664/4243767',
  NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trial_sessions (id, club_id, title, description, date, start_time, end_time, location, address, max_participants, min_age, max_age, requirements)
VALUES (
  'b1000000-0000-0000-0000-000000000006',
  'a1000000-0000-0000-0000-000000000006',
  'Footvolley Schnuppertraining',
  'Probiere Footvolley aus – Fußball trifft Volleyball! Keine Vorkenntnisse nötig.',
  '2026-06-25',
  '16:00:00',
  '17:30:00',
  'Odilieninstitut Graz',
  NULL,
  20,
  NULL,
  NULL,
  'Sportkleidung und Fußballschuhe mitbringen. Trainer: Stefan Lutz, Tel. 0664/4243767'
)
ON CONFLICT (id) DO NOTHING;
