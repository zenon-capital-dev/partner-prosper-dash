REVOKE EXECUTE ON FUNCTION public.notify_document_recipient() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_primary_collaborator_to_client() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_primary_partner_to_client() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_primary_provider_to_client() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_primary_provider_to_demand() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_primary_referrer_to_client() FROM PUBLIC, anon, authenticated;