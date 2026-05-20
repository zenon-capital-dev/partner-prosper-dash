-- Onda 3: índices que faltam para acelerar listagens
CREATE INDEX IF NOT EXISTS idx_commissions_status_partner ON public.commissions(status, partner_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON public.tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_commissions_sale_id ON public.commissions(sale_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);