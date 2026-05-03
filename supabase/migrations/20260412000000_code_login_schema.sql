-- ============================================================
-- Code-based Login Schema
-- Ursulinen Graz – Pilotschule
-- ============================================================

-- 1. schools
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. classes
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. students
CREATE TABLE IF NOT EXISTS public.students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  display_suffix text DEFAULT '',
  display_name text NOT NULL,
  login_code text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. teachers
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  login_code text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 5. teacher_class_access
CREATE TABLE IF NOT EXISTS public.teacher_class_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(teacher_id, class_id)
);

-- 6. active_sessions
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_type text NOT NULL CHECK (user_type IN ('student', 'teacher')),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  login_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  active boolean DEFAULT true
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_active_sessions_device_id ON public.active_sessions(device_id, active);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON public.active_sessions(user_id, user_type, active);
CREATE INDEX IF NOT EXISTS idx_students_login_code ON public.students(login_code);
CREATE INDEX IF NOT EXISTS idx_teachers_login_code ON public.teachers(login_code);

-- RLS: all access is via SECURITY DEFINER RPCs only
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_class_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RPC: login_with_code
-- Takes a code + device_id, returns user data or error
-- ============================================================
CREATE OR REPLACE FUNCTION public.login_with_code(
  p_code    text,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student   students%ROWTYPE;
  v_teacher   teachers%ROWTYPE;
  v_class     classes%ROWTYPE;
  v_school    schools%ROWTYPE;
  v_session_id uuid;
BEGIN
  -- Normalize code (trim + uppercase)
  p_code := upper(trim(p_code));

  -- ── Check students ─────────────────────────────────────
  SELECT * INTO v_student
  FROM students
  WHERE login_code = p_code AND active = true;

  IF FOUND THEN
    -- Invalidate all existing sessions for this student
    UPDATE active_sessions
    SET active = false
    WHERE user_id = v_student.id AND user_type = 'student' AND active = true;

    -- Create new session
    INSERT INTO active_sessions (user_type, user_id, device_id, login_code)
    VALUES ('student', v_student.id, p_device_id, p_code)
    RETURNING id INTO v_session_id;

    -- Resolve class + school
    SELECT * INTO v_class  FROM classes WHERE id = v_student.class_id;
    SELECT * INTO v_school FROM schools WHERE id = v_class.school_id;

    RETURN jsonb_build_object(
      'user_type',   'student',
      'user_id',     v_student.id,
      'display_name', v_student.display_name,
      'class_id',    v_student.class_id,
      'class_name',  v_class.name,
      'school_name', v_school.name,
      'session_id',  v_session_id,
      'device_id',   p_device_id
    );
  END IF;

  -- ── Check teachers ─────────────────────────────────────
  SELECT * INTO v_teacher
  FROM teachers
  WHERE login_code = p_code AND active = true;

  IF FOUND THEN
    -- Invalidate all existing sessions for this teacher
    UPDATE active_sessions
    SET active = false
    WHERE user_id = v_teacher.id AND user_type = 'teacher' AND active = true;

    -- Create new session
    INSERT INTO active_sessions (user_type, user_id, device_id, login_code)
    VALUES ('teacher', v_teacher.id, p_device_id, p_code)
    RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
      'user_type',   'teacher',
      'user_id',     v_teacher.id,
      'display_name', v_teacher.full_name,
      'session_id',  v_session_id,
      'device_id',   p_device_id
    );
  END IF;

  -- Nothing found
  RETURN jsonb_build_object('error', 'Ungültiger Code');
END;
$$;


-- ============================================================
-- RPC: validate_session
-- Called on app start to restore session from localStorage
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_session(
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session   active_sessions%ROWTYPE;
  v_student   students%ROWTYPE;
  v_teacher   teachers%ROWTYPE;
  v_class     classes%ROWTYPE;
  v_school    schools%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM active_sessions
  WHERE device_id = p_device_id AND active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Session');
  END IF;

  -- Update last_seen_at
  UPDATE active_sessions
  SET last_seen_at = now()
  WHERE id = v_session.id;

  IF v_session.user_type = 'student' THEN
    SELECT * INTO v_student FROM students WHERE id = v_session.user_id AND active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Schüler nicht mehr aktiv');
    END IF;
    SELECT * INTO v_class  FROM classes WHERE id = v_student.class_id;
    SELECT * INTO v_school FROM schools WHERE id = v_class.school_id;

    RETURN jsonb_build_object(
      'user_type',   'student',
      'user_id',     v_student.id,
      'display_name', v_student.display_name,
      'class_id',    v_student.class_id,
      'class_name',  v_class.name,
      'school_name', v_school.name,
      'session_id',  v_session.id,
      'device_id',   p_device_id
    );
  END IF;

  IF v_session.user_type = 'teacher' THEN
    SELECT * INTO v_teacher FROM teachers WHERE id = v_session.user_id AND active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Lehrkraft nicht mehr aktiv');
    END IF;

    RETURN jsonb_build_object(
      'user_type',   'teacher',
      'user_id',     v_teacher.id,
      'display_name', v_teacher.full_name,
      'session_id',  v_session.id,
      'device_id',   p_device_id
    );
  END IF;

  RETURN jsonb_build_object('error', 'Unbekannter Benutzertyp');
END;
$$;


-- ============================================================
-- RPC: get_teacher_classes
-- Returns the classes a teacher may see (with student counts)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_teacher_classes(
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session active_sessions%ROWTYPE;
  v_result  jsonb;
BEGIN
  SELECT * INTO v_session
  FROM active_sessions
  WHERE device_id = p_device_id AND active = true AND user_type = 'teacher'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Lehrer-Session');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'class_id',       c.id,
      'class_name',     c.name,
      'school_name',    s.name,
      'student_count',  (SELECT count(*) FROM students st WHERE st.class_id = c.id AND st.active = true)
    )
    ORDER BY c.name
  ) INTO v_result
  FROM teacher_class_access tca
  JOIN classes c ON c.id = tca.class_id
  JOIN schools s ON s.id = c.school_id
  WHERE tca.teacher_id = v_session.user_id
    AND c.active = true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- ============================================================
-- RPC: get_class_students
-- Returns students in a class (teacher must have access)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_class_students(
  p_device_id text,
  p_class_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session active_sessions%ROWTYPE;
  v_access  boolean;
  v_result  jsonb;
BEGIN
  SELECT * INTO v_session
  FROM active_sessions
  WHERE device_id = p_device_id AND active = true AND user_type = 'teacher'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Keine aktive Lehrer-Session');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM teacher_class_access
    WHERE teacher_id = v_session.user_id AND class_id = p_class_id
  ) INTO v_access;

  IF NOT v_access THEN
    RETURN jsonb_build_object('error', 'Kein Zugriff auf diese Klasse');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'student_id',    id,
      'display_name',  display_name,
      'first_name',    first_name
    )
    ORDER BY display_name
  ) INTO v_result
  FROM students
  WHERE class_id = p_class_id AND active = true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- ============================================================
-- Beispieldaten – Ursulinen Graz
-- SICHERHEITSHINWEIS: Die Login-Codes unten sind Seed-Daten für
-- die erste Einrichtung. Nach dem ersten Deployment müssen alle
-- Codes sofort in der Datenbank rotiert werden (UPDATE teachers/students
-- SET login_code = '...' WHERE id = '...').
-- ============================================================

DO $$
DECLARE
  v_school_id  uuid;
  v_class_3a   uuid;
  v_class_3b   uuid;
  v_class_3c   uuid;
  v_teacher_berger  uuid;
  v_teacher_steiner uuid;
  v_teacher_fuchs   uuid;
BEGIN
  -- School
  INSERT INTO public.schools (name, active)
  VALUES ('Ursulinen Graz', true)
  RETURNING id INTO v_school_id;

  -- Classes
  INSERT INTO public.classes (school_id, name, active) VALUES (v_school_id, '3a', true) RETURNING id INTO v_class_3a;
  INSERT INTO public.classes (school_id, name, active) VALUES (v_school_id, '3b', true) RETURNING id INTO v_class_3b;
  INSERT INTO public.classes (school_id, name, active) VALUES (v_school_id, '3c', true) RETURNING id INTO v_class_3c;

  -- Teachers
  INSERT INTO public.teachers (full_name, login_code, active)
  VALUES ('Mag. Anna Berger', 'T7K9MR4Q', true)
  RETURNING id INTO v_teacher_berger;

  INSERT INTO public.teachers (full_name, login_code, active)
  VALUES ('Mag. Lukas Steiner', 'L8QW5VTR', true)
  RETURNING id INTO v_teacher_steiner;

  INSERT INTO public.teachers (full_name, login_code, active)
  VALUES ('Mag. Eva Fuchs', 'E6RM8TKQ', true)
  RETURNING id INTO v_teacher_fuchs;

  -- Teacher access
  INSERT INTO public.teacher_class_access (teacher_id, class_id) VALUES (v_teacher_berger,  v_class_3a);
  INSERT INTO public.teacher_class_access (teacher_id, class_id) VALUES (v_teacher_berger,  v_class_3b);
  INSERT INTO public.teacher_class_access (teacher_id, class_id) VALUES (v_teacher_steiner, v_class_3c);

  -- Students – Klasse 3a
  INSERT INTO public.students (class_id, first_name, display_suffix, display_name, login_code) VALUES
    (v_class_3a, 'Paul',  '',  'Paul',   '7KX4PM2R'),
    (v_class_3a, 'Paul',  '2', 'Paul 2', '4ZT8QW6M'),
    (v_class_3a, 'Mia',   '',  'Mia',    '8RMY6T2K'),
    (v_class_3a, 'Leon',  '',  'Leon',   '6VCP9XN4'),
    (v_class_3a, 'Sofia', '',  'Sofia',  '3QTR8WK7');

  -- Students – Klasse 3b
  INSERT INTO public.students (class_id, first_name, display_suffix, display_name, login_code) VALUES
    (v_class_3b, 'Emma',  '', 'Emma',  '9KWR6TP3'),
    (v_class_3b, 'Noah',  '', 'Noah',  '5MXT7RV8'),
    (v_class_3b, 'Anna',  '', 'Anna',  '2QWP8VK6'),
    (v_class_3b, 'David', '', 'David', '7TRK5YM4'),
    (v_class_3b, 'Lena',  '', 'Lena',  '8VKM3QRP');

  -- Students – Klasse 3c
  INSERT INTO public.students (class_id, first_name, display_suffix, display_name, login_code) VALUES
    (v_class_3c, 'Jakob', '', 'Jakob', '6QMV8TRK'),
    (v_class_3c, 'Marie', '', 'Marie', '4XTP7KWR'),
    (v_class_3c, 'Elias', '', 'Elias', '9RMK5VQT'),
    (v_class_3c, 'Hanna', '', 'Hanna', '3VKQ8MTR'),
    (v_class_3c, 'Felix', '', 'Felix', '8TWR6QKM');
END $$;
