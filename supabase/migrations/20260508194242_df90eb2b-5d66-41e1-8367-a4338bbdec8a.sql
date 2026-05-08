-- 1. Correção de Segurança: Adicionar search_path em todas as funções SECURITY DEFINER
ALTER FUNCTION public.notify_on_commission_status() SET search_path = public;
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION public.notify_on_contract() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;
ALTER FUNCTION public.notify_on_document() SET search_path = public;
ALTER FUNCTION public.notify_on_sale() SET search_path = public;
ALTER FUNCTION public.generate_commission_splits() SET search_path = public;
ALTER FUNCTION public.log_action(text, text, uuid, jsonb, jsonb) SET search_path = public;
ALTER FUNCTION public.notify_on_lead() SET search_path = public;
ALTER FUNCTION public.notify_on_task_assign() SET search_path = public;
ALTER FUNCTION public.notify_admins(text, text, text, text) SET search_path = public;
ALTER FUNCTION public.handle_new_sale() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.sync_commission_split_status() SET search_path = public;
ALTER FUNCTION public.notify_on_contract_change() SET search_path = public;
ALTER FUNCTION public.on_contract_status_change() SET search_path = public;
ALTER FUNCTION public.notify_on_document_request_change() SET search_path = public;
ALTER FUNCTION public.on_status_report_inserted() SET search_path = public;
ALTER FUNCTION public.is_delegated_provider(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.handle_sale_splits() SET search_path = public;

-- 2. Garantir gatilhos de auditoria em tabelas adicionais
DROP TRIGGER IF EXISTS log_contracts_activity ON public.contracts;
CREATE TRIGGER log_contracts_activity AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_documents_activity ON public.documents;
CREATE TRIGGER log_documents_activity AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_commission_splits_activity ON public.commission_splits;
CREATE TRIGGER log_commission_splits_activity AFTER INSERT OR UPDATE OR DELETE ON public.commission_splits FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_status_reports_activity ON public.client_product_status_reports;
CREATE TRIGGER log_status_reports_activity AFTER INSERT OR UPDATE OR DELETE ON public.client_product_status_reports FOR EACH ROW EXECUTE FUNCTION public.log_activity();
