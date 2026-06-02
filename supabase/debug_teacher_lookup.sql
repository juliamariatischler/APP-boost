-- Query A: Lehrerin in auth.users finden
SELECT id, email, raw_user_meta_data->>'username' AS username, created_at
FROM auth.users
WHERE lower(email) LIKE '%rogner%'
   OR lower(email) LIKE '%pestalozzi%'
   OR lower(raw_user_meta_data::text) LIKE '%roschine%'
   OR lower(raw_user_meta_data::text) LIKE '%rogner%';

-- Query B: Existierende teacher_class_assignments für Pestalozzi
SELECT
  tca.teacher_id,
  u.email AS teacher_email,
  c.name  AS class_name,
  s.name  AS school_name
FROM public.teacher_class_assignments tca
JOIN public.classes c ON c.id = tca.class_id
JOIN public.schools s ON s.id = tca.school_id
JOIN auth.users     u ON u.id = tca.teacher_id
WHERE s.id = '457d7d87-2abc-413c-8d3f-16281085a5bb'
ORDER BY c.name;
