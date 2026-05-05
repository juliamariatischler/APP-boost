CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.active_sessions
  WHERE user_id = v_user_id;

  DELETE FROM auth.users
  WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
