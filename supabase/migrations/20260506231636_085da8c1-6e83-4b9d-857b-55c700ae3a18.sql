-- 1. Fix search path
ALTER FUNCTION public.has_role(text[]) SET search_path = public;

-- 2. Restrict execution to authenticated users
REVOKE EXECUTE ON FUNCTION public.has_role(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(text[]) TO authenticated;
