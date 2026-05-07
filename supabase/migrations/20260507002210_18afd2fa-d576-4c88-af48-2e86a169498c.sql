-- Fix security for functions with correct signatures

-- 1. has_role (UUID, app_role)
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;

-- 2. is_admin (UUID)
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;

-- 3. handle_new_user ()
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- 4. handle_new_sale ()
ALTER FUNCTION public.handle_new_sale() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_sale() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_sale() FROM authenticated;

-- 5. generate_commission_splits ()
ALTER FUNCTION public.generate_commission_splits() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.generate_commission_splits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_commission_splits() FROM authenticated;

-- 6. log_action (text, text, uuid, jsonb, jsonb)
ALTER FUNCTION public.log_action(text, text, uuid, jsonb, jsonb) SET search_path = public;

-- 7. has_role (text[])
ALTER FUNCTION public.has_role(text[]) SET search_path = public;
