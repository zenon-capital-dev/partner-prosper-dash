REVOKE EXECUTE ON FUNCTION public.can_access_signature_object(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_signature_stage(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_new_partner_ticket() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_partner_support_message() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_assignee_on_task_comment() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_client_on_new_delivery() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_collaborator_on_demand_assign() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_collaborator_on_demand_status_change() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_partner_on_admin_ticket_reply() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_partner_on_contract_signed() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_partners_on_new_material() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_provider_on_client_document_upload() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_provider_on_demand_assign() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_access_signature_object(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_signature_stage(uuid) TO authenticated, service_role;