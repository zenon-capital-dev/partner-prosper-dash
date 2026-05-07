-- Fix: grant EXECUTE on security definer functions to authenticated role
-- This was blocking all admin queries (clients, sales, partners, documents, etc)
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;