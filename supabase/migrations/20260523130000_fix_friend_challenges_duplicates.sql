-- Remove duplicate friend_challenges rows, keeping the oldest per name
DELETE FROM public.friend_challenges
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.friend_challenges
  ORDER BY name, created_at ASC
);

-- Prevent future duplicates
ALTER TABLE public.friend_challenges
  ADD CONSTRAINT friend_challenges_name_unique UNIQUE (name);
