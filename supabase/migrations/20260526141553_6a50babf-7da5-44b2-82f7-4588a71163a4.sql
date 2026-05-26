GRANT SELECT, INSERT, UPDATE, DELETE ON public.collaborator_products TO authenticated;
GRANT ALL ON public.collaborator_products TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_provider_products TO authenticated;
GRANT ALL ON public.service_provider_products TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_required_documents TO authenticated;
GRANT ALL ON public.product_required_documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_steps TO authenticated;
GRANT ALL ON public.product_steps TO service_role;