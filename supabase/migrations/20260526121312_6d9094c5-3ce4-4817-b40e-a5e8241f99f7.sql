
-- Strict primary-admin check (only role = 'admin', NOT admin_secondary)
CREATE OR REPLACE FUNCTION private.is_primary_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role = 'admin'::public.app_role
  );
$$;

REVOKE ALL ON FUNCTION private.is_primary_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_primary_admin(uuid) TO authenticated, service_role;

-- Replace mutation policies on user_roles to require primary admin
DROP POLICY IF EXISTS "Only admins insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins delete user roles" ON public.user_roles;

CREATE POLICY "Only primary admins insert user roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_primary_admin(auth.uid()));

CREATE POLICY "Only primary admins update user roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (private.is_primary_admin(auth.uid()))
  WITH CHECK (private.is_primary_admin(auth.uid()));

CREATE POLICY "Only primary admins delete user roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (private.is_primary_admin(auth.uid()));
