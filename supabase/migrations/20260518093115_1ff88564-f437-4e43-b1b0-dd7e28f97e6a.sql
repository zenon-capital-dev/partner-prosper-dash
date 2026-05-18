-- Aplicando fix de segurança para search_path e permissões
ALTER FUNCTION public.handle_new_sale() SET search_path = public;
ALTER FUNCTION public.handle_payment_update() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_sale() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_payment_update() FROM PUBLIC;
