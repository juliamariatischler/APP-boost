-- Add persistent avatar item columns to profiles.
-- equipped_avatar_item: the currently displayed item (can be changed freely).
-- owned_avatar_items:   permanent collection of unlocked item IDs (never shrinks).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS equipped_avatar_item TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS owned_avatar_items   TEXT[] DEFAULT '{}';
