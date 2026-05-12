DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;

CREATE POLICY "Admins manage user roles without recursion"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.check_is_admin(auth.uid()))
WITH CHECK (public.check_is_admin(auth.uid()));