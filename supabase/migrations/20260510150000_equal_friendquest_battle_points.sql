-- Friendquest battles should award 50 Blitze total: 25 per participant.

ALTER TABLE public.friend_challenges
  ALTER COLUMN winner_points SET DEFAULT 25,
  ALTER COLUMN loser_points SET DEFAULT 25;

UPDATE public.friend_challenges
SET winner_points = 25,
    loser_points = 25
WHERE name IN (
  'Kniebeugen-Battle',
  'Liegestütz-Duell',
  'Schritte-Challenge',
  'Sit-ups-Battle',
  'Jumping-Jacks',
  'Plank-Challenge'
);
