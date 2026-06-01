-- Merge "Ursulinen" into "Ursulinen Gym":
-- Both names refer to the same school. The schools table has "Ursulinen Gym"
-- (with real students, class 3E) while presentation_class_rankings has "Ursulinen"
-- (demo entry, class 3e). This causes two separate rows in the Klassenranking.
-- Fix: rename the demo entry to "Ursulinen Gym" and remove it so the real
-- student data under "Ursulinen Gym / 3E" takes over cleanly.

-- 1. The schools table already uses "Ursulinen Gym" — no change needed there.

-- 2. Sync the free-text school field in profiles (in case any use "Ursulinen")
UPDATE public.profiles
SET school = 'Ursulinen Gym'
WHERE school = 'Ursulinen';

-- 3. Sync class_quest_bonus_awards if any exist under the old name
UPDATE public.class_quest_bonus_awards
SET school = 'Ursulinen Gym'
WHERE school = 'Ursulinen';

-- 4. Remove the stale demo entry for (Ursulinen, 3e).
--    The real school shows as (Ursulinen Gym, 3E) via the new_student_totals CTE.
--    The demo entry now has a different name AND different class case, so we
--    delete it explicitly to avoid it appearing alongside the real data.
DELETE FROM public.presentation_class_rankings
WHERE school = 'Ursulinen' AND class = '3e';

NOTIFY pgrst, 'reload schema';
