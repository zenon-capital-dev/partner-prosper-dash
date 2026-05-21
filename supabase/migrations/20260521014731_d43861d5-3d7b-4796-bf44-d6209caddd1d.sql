REVOKE ALL ON FUNCTION public.sync_sale_to_client_product() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propagate_client_provider() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propagate_client_collaborator() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fill_task_assigned_from_demand() FROM PUBLIC, anon, authenticated;