REVOKE EXECUTE ON FUNCTION public.can_access_product_folder(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_product_folder(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_product_folder(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_product_folder(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_client_of_product(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_client_of_product(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_client_of_product(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_of_product(uuid, uuid) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_document_folders TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.product_document_folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_document_files TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.product_document_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demand_comments TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.demand_comments TO service_role;