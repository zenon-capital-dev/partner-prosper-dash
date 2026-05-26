REVOKE ALL ON FUNCTION public.admin_delete_product_cascade(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_client_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_product_cascade(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_client_cascade(uuid) TO authenticated;