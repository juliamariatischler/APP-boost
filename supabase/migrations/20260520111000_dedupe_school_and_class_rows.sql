-- Hotfix: merge duplicate school/class rows that can appear after school renames.
-- Keeps one canonical row per school name and one canonical row per school/class.

WITH canonical_schools AS (
  SELECT lower(trim(name)) AS school_key, min(id::text)::uuid AS keep_id
  FROM public.schools
  GROUP BY lower(trim(name))
),
duplicate_schools AS (
  SELECT s.id AS old_id, c.keep_id
  FROM public.schools s
  JOIN canonical_schools c ON c.school_key = lower(trim(s.name))
  WHERE s.id <> c.keep_id
)
UPDATE public.classes cls
SET school_id = duplicate_schools.keep_id
FROM duplicate_schools
WHERE cls.school_id = duplicate_schools.old_id;

WITH canonical_schools AS (
  SELECT lower(trim(name)) AS school_key, min(id::text)::uuid AS keep_id
  FROM public.schools
  GROUP BY lower(trim(name))
)
DELETE FROM public.schools s
USING canonical_schools c
WHERE lower(trim(s.name)) = c.school_key
  AND s.id <> c.keep_id;

WITH canonical_classes AS (
  SELECT school_id, lower(trim(name)) AS class_key, min(id::text)::uuid AS keep_id
  FROM public.classes
  GROUP BY school_id, lower(trim(name))
),
duplicate_classes AS (
  SELECT c.id AS old_id, cc.keep_id
  FROM public.classes c
  JOIN canonical_classes cc
    ON cc.school_id = c.school_id
   AND cc.class_key = lower(trim(c.name))
  WHERE c.id <> cc.keep_id
)
UPDATE public.students st
SET class_id = duplicate_classes.keep_id
FROM duplicate_classes
WHERE st.class_id = duplicate_classes.old_id;

WITH canonical_classes AS (
  SELECT school_id, lower(trim(name)) AS class_key, min(id::text)::uuid AS keep_id
  FROM public.classes
  GROUP BY school_id, lower(trim(name))
),
duplicate_classes AS (
  SELECT c.id AS old_id, cc.keep_id
  FROM public.classes c
  JOIN canonical_classes cc
    ON cc.school_id = c.school_id
   AND cc.class_key = lower(trim(c.name))
  WHERE c.id <> cc.keep_id
)
INSERT INTO public.teacher_class_access (teacher_id, class_id)
SELECT DISTINCT tca.teacher_id, duplicate_classes.keep_id
FROM public.teacher_class_access tca
JOIN duplicate_classes ON duplicate_classes.old_id = tca.class_id
ON CONFLICT (teacher_id, class_id) DO NOTHING;

WITH canonical_classes AS (
  SELECT school_id, lower(trim(name)) AS class_key, min(id::text)::uuid AS keep_id
  FROM public.classes
  GROUP BY school_id, lower(trim(name))
),
duplicate_classes AS (
  SELECT c.id AS old_id
  FROM public.classes c
  JOIN canonical_classes cc
    ON cc.school_id = c.school_id
   AND cc.class_key = lower(trim(c.name))
  WHERE c.id <> cc.keep_id
)
DELETE FROM public.teacher_class_access tca
USING duplicate_classes
WHERE tca.class_id = duplicate_classes.old_id;

WITH canonical_classes AS (
  SELECT school_id, lower(trim(name)) AS class_key, min(id::text)::uuid AS keep_id
  FROM public.classes
  GROUP BY school_id, lower(trim(name))
)
DELETE FROM public.classes c
USING canonical_classes cc
WHERE cc.school_id = c.school_id
  AND cc.class_key = lower(trim(c.name))
  AND c.id <> cc.keep_id;
