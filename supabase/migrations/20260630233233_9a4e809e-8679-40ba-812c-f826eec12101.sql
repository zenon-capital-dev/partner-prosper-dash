CREATE OR REPLACE FUNCTION private.storage_is_internal(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role, 'super_admin'::public.app_role, 'vendedor'::public.app_role)
  );
$function$;