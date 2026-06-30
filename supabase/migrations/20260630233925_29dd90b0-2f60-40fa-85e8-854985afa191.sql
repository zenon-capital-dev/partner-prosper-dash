CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role, 'super_admin'::public.app_role)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role, 'super_admin'::public.app_role)
  )
$function$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role, 'super_admin'::public.app_role)
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role, 'super_admin'::public.app_role)
  );
$function$;

DROP POLICY IF EXISTS "Admins can manage client products" ON public.client_products;
CREATE POLICY "Admins can manage client products"
ON public.client_products
FOR ALL
TO authenticated
USING (private.is_admin((SELECT auth.uid())))
WITH CHECK (private.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins manage demand providers" ON public.client_product_providers;
CREATE POLICY "Admins manage demand providers"
ON public.client_product_providers
FOR ALL
TO authenticated
USING (private.is_admin((SELECT auth.uid())))
WITH CHECK (private.is_admin((SELECT auth.uid())));