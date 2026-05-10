-- Seed friend_challenges with battle options for kids

INSERT INTO public.friend_challenges (name, description, icon, winner_points, loser_points)
VALUES
  ('Kniebeugen-Battle',  'Wer schafft mehr Kniebeugen in 2 Minuten?',   '🦵', 25, 25),
  ('Liegestütz-Duell',   'Wer schafft mehr Liegestütze am Stück?',       '💪', 25, 25),
  ('Schritte-Challenge', 'Wer sammelt heute mehr Schritte?',             '👟', 25, 25),
  ('Sit-ups-Battle',     'Wer schafft mehr Sit-ups in 2 Minuten?',       '🔥', 25, 25),
  ('Jumping-Jacks',      'Wer macht mehr Jumping Jacks in 1 Minute?',    '⚡', 25, 25),
  ('Plank-Challenge',    'Wer hält die Plank am längsten?',              '🏆', 25, 25)
ON CONFLICT DO NOTHING;
