CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at_desc ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status_due_date ON public.payments (status, due_date);
CREATE INDEX IF NOT EXISTS idx_documents_created_status ON public.documents (created_at DESC, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at_desc ON public.tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at_desc ON public.commissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_splits_created_at_desc ON public.commission_splits (created_at DESC);