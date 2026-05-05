-- Make code-login SECURITY DEFINER functions explicit about who may execute.
-- The app calls these with the public anon key because this auth path is
-- independent from Supabase Auth sessions.

REVOKE EXECUTE ON FUNCTION public.login_with_code(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_session(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_teacher_classes(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_class_students(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.login_with_code(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_session(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_classes(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_class_students(text, uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.login_with_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_classes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_students(text, uuid) TO authenticated;
