GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_partners TO authenticated;
GRANT ALL ON public.client_partners TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_referrers TO authenticated;
GRANT ALL ON public.client_referrers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_collaborators TO authenticated;
GRANT ALL ON public.client_collaborators TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_providers TO authenticated;
GRANT ALL ON public.client_providers TO service_role;