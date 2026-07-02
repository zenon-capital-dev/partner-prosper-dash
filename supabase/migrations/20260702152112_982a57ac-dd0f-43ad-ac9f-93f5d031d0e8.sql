REVOKE ALL ON FUNCTION public.sync_client_status_from_journey_stage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_client_status_from_journey_stage() TO service_role;