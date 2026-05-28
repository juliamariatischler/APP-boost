-- Fix: column reference "id" is ambiguous in add_class_to_school.
-- RETURNS TABLE(id uuid, name text) makes "id" an OUT parameter that's in scope
-- during the internal IF NOT EXISTS query, creating ambiguity with schools.id.
-- Solution: use a table alias so the column reference is unambiguous.

CREATE OR REPLACE FUNCTION public.add_class_to_school(
  p_school_id  uuid,
  p_class_name text
)
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id   uuid;
  v_name text := trim(p_class_name);
BEGIN
  IF length(v_name) < 1 THEN
    RAISE EXCEPTION 'Klassenname darf nicht leer sein';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.schools sch WHERE sch.id = p_school_id AND sch.active = true) THEN
    RAISE EXCEPTION 'Schule nicht gefunden';
  END IF;

  INSERT INTO public.classes (school_id, name, active)
  VALUES (p_school_id, v_name, true)
  ON CONFLICT DO NOTHING;

  SELECT c.id INTO v_id
  FROM   public.classes c
  WHERE  c.school_id = p_school_id AND c.name = v_name;

  RETURN QUERY SELECT v_id, v_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_class_to_school(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_class_to_school(uuid, text) TO authenticated;
