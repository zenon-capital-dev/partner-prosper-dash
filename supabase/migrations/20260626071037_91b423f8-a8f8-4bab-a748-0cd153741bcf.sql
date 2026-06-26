REVOKE ALL ON FUNCTION public.credit_project_pool_on_payment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_project_pool_on_payment() FROM anon;
REVOKE ALL ON FUNCTION public.credit_project_pool_on_payment() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_project_pool_on_payment() TO service_role;