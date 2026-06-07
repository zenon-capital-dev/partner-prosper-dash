CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients (user_id);
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON public.partners (user_id);
CREATE INDEX IF NOT EXISTS idx_referrers_user_id ON public.referrers (user_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);