
-- Funções que NÃO devem ser chamadas diretamente por usuários autenticados
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_pending_commissions() FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_overdue_documents() FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_payments() FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_action(text, text, uuid, jsonb, jsonb) FROM authenticated, PUBLIC;
