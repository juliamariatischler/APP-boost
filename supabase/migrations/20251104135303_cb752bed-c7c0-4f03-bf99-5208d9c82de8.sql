-- Add RLS policies for user_roles table to secure admin role management

-- Policy 1: Allow admins to manage all roles (select, insert, update, delete)
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy 2: Allow users to view their own roles (needed for UI logic)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());