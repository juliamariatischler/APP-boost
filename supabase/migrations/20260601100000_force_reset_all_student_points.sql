-- Erzwingt Punkte-Reset für ALLE Schüler (beide Systeme: students-Tabelle + alte Profile)
-- Betrifft keine Lehrer (role = 'teacher') und keine Admins (role = 'admin')

DO $$
DECLARE
  v_st int := 0;
  v_pr int := 0;
BEGIN

  -- Alle Schüler in students-Tabelle (auch deaktivierte)
  UPDATE public.students SET points = 0;
  GET DIAGNOSTICS v_st = ROW_COUNT;
  RAISE NOTICE 'students.points auf 0: %', v_st;

  -- Alle Profile die kein Lehrer und kein Admin sind
  UPDATE public.profiles
  SET points = 0
  WHERE role IS DISTINCT FROM 'teacher'
    AND role IS DISTINCT FROM 'admin';
  GET DIAGNOSTICS v_pr = ROW_COUNT;
  RAISE NOTICE 'profiles.points auf 0: %', v_pr;

  RAISE NOTICE '✓ Alle Schüler-Punkte zurückgesetzt.';
END;
$$;
