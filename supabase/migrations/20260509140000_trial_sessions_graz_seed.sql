-- Seed: 5 Schnuppertermine in und um Graz
-- Clubs werden mit fixen UUIDs eingefügt, damit der Import idempotent bleibt

INSERT INTO public.clubs (id, name, sport_type, description, contact_email, contact_phone, website)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'SK Sturm Graz Jugend',
    'Fußball',
    'Nachwuchsabteilung des SK Sturm Graz – Schnuppern beim Traditionsverein.',
    'jugend@sksturm.at',
    '+43 316 123 456',
    'https://www.sksturm.at'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'Badminton Club Graz',
    'Badminton',
    'Einer der größten Badmintonclubs in der Steiermark.',
    'office@bcgraz.at',
    '+43 316 234 567',
    'https://www.bcgraz.at'
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'Schwimmclub Graz',
    'Schwimmen',
    'Wettkampf- und Breitensport-Schwimmen für alle Altersgruppen.',
    'info@scgraz.at',
    '+43 316 345 678',
    NULL
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'Basket Flames Graz',
    'Basketball',
    'Jugendbasketball in Graz – Spaß und Teamgeist stehen im Vordergrund.',
    'info@basketflames.at',
    '+43 316 456 789',
    'https://www.basketflames.at'
  ),
  (
    'a1000000-0000-0000-0000-000000000005',
    'Tennisclub Liebenau',
    'Tennis',
    'Tennisclub im Grazer Süden mit Freiluft- und Hallenplätzen.',
    'office@tc-liebenau.at',
    '+43 316 567 890',
    NULL
  )
ON CONFLICT (id) DO NOTHING;


INSERT INTO public.trial_sessions (id, club_id, title, description, date, start_time, end_time, location, address, max_participants, min_age, max_age, requirements)
VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'Fußball Schnuppertraining',
    'Komm vorbei und teste das Training beim SK Sturm Graz Nachwuchs. Keine Vorkenntnisse nötig.',
    '2026-05-17',
    '09:00:00',
    '11:00:00',
    'Trainingszentrum Messendorf',
    'Messendorfer Straße 120, 8042 Graz',
    15,
    8,
    14,
    'Sportkleidung und Fußballschuhe (Stollen oder Nocken) mitbringen.'
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',
    'Badminton Probestunde',
    'Erste Schritte im Badminton – Technik, Spiel und Spaß für Einsteiger.',
    '2026-05-20',
    '15:00:00',
    '17:00:00',
    'Sporthalle Eggenberg',
    'Reininghausstraße 45, 8020 Graz',
    12,
    9,
    16,
    'Hallenschuhe erforderlich. Schläger können geliehen werden.'
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000003',
    'Schwimmen – Technik & Spaß',
    'Schnuppere in den Vereinsschwimmsport hinein. Freistil und Rückenschwimmen für Anfänger.',
    '2026-05-24',
    '10:00:00',
    '12:00:00',
    'Hallenbad Graz-Mitte',
    'Kärntner Straße 10, 8010 Graz',
    10,
    8,
    15,
    'Schwimmkenntnisse (25 m) erforderlich. Badekappe und Schwimmbrille mitbringen.'
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000004',
    'Basketball Highlight-Camp',
    'Ein ganztägiges Erlebnis mit Drills, 3-on-3 und Teamspiel – das Highlight für alle Basketballfans.',
    '2026-05-31',
    '09:00:00',
    '18:00:00',
    'Sporthalle Liebenau',
    'Puntigamer Straße 100, 8041 Graz',
    16,
    10,
    16,
    'Hallenschuhe und Sportkleidung. Verpflegung wird gestellt.'
  ),
  (
    'b1000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000005',
    'Tennis Schnuppertag',
    'Lerne die Grundschläge kennen und spiele dein erstes Match unter Anleitung erfahrener Trainer.',
    '2026-06-07',
    '10:00:00',
    '12:30:00',
    'Tennisclub Liebenau',
    'Liebenauer Hauptstraße 60, 8041 Graz',
    10,
    8,
    14,
    'Sportschuhe (keine Stollen). Schläger können ausgeliehen werden.'
  )
ON CONFLICT (id) DO NOTHING;
