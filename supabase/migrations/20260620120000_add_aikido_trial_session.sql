-- Add Aikido Graz with a fixed trial session on Tuesday 23.06.2026, 16:30–18:30
-- Wöchentliches Training (Dienstag) im Raiffeisen Sportpark
-- Kontakt/Anmeldung über Trainer Valentin Lasnik

INSERT INTO public.clubs (id, name, sport_type, description, contact_email, contact_phone, website)
VALUES (
  'a1000000-0000-0000-0000-000000000008',
  'Aikido Graz',
  'Aikido',
  'Schnuppertraining bei Aikido Graz – Wurf- und Selbstverteidigungstechniken aus der japanischen Kampfkunst. Keine Vorkenntnisse nötig.',
  'V.lasnik@aikidopro.at',
  '0676/9430503',
  'https://www.aikidopro.at'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trial_sessions (id, club_id, title, description, date, start_time, end_time, location, address, max_participants, min_age, max_age, requirements)
VALUES (
  'b1000000-0000-0000-0000-000000000008',
  'a1000000-0000-0000-0000-000000000008',
  'Aikido Schnuppertraining',
  'Komm dienstags vorbei und probiere Aikido aus! Keine Vorkenntnisse nötig.',
  '2026-06-23',
  '16:30:00',
  '18:30:00',
  'Raiffeisen Sportpark',
  NULL,
  20,
  NULL,
  NULL,
  'Bequeme Sportkleidung mitbringen. Training jeden Dienstag, 16:30–18:30 Uhr. Trainer: Valentin Lasnik, Tel. 0676/9430503.'
)
ON CONFLICT (id) DO NOTHING;
