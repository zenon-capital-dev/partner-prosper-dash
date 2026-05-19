-- Revoke public execution on security definer functions
-- Corrected signatures based on DB inspection
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_activity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_lead() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_task_assign() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_contract() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_contract_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_payment_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_commission_splits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_payments() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.maybe_release_commission() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_client_product_steps() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_client_collaborator() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_client_provider() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_client_product_responsible() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_client_product_provider() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_sale_splits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_sale() FROM PUBLIC;

-- Re-grant to authenticated users ONLY for functions they NEED to call directly
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_admin(uuid) TO authenticated;
