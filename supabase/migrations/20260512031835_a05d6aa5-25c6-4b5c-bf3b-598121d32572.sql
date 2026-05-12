-- Fix the parameterless version of private.is_admin()
-- The previous version was recursively calling itself or potentially failing if auth.uid() wasn't correctly handled
CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role)
  );
$function$;

-- Ensure the version with parameter is also solid
CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role)
  );
$function$;

-- Clean up redundant user_roles policies that might be causing confusion
DROP POLICY IF EXISTS "Only admins delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin delete" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles select own" ON public.user_roles;

-- Recreate clean, efficient policies for user_roles
CREATE POLICY "Admins manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "Users view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
