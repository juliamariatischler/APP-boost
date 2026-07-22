-- Rewards are temporarily hidden while the page is in coming-soon mode.
-- Keep historical data intact, but stop active reward and class milestone reads.
UPDATE public.reward_items
SET is_active = false,
    updated_at = now()
WHERE is_active = true;

UPDATE public.class_milestones
SET is_active = false,
    updated_at = now()
WHERE is_active = true;
