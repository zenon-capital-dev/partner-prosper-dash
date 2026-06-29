
-- Índices para acelerar as queries mais lentas detectadas no pg_stat_statements.
-- Todos IF NOT EXISTS para serem idempotentes.

CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks (client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_client_product_id ON public.tasks (client_product_id);

CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents (client_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_product_id ON public.documents (client_product_id);

CREATE INDEX IF NOT EXISTS idx_payments_client_id_due_date ON public.payments (client_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments (sale_id);

CREATE INDEX IF NOT EXISTS idx_client_products_client_id ON public.client_products (client_id);
CREATE INDEX IF NOT EXISTS idx_client_products_product_id ON public.client_products (product_id);
CREATE INDEX IF NOT EXISTS idx_client_products_service_provider_id ON public.client_products (service_provider_id);
CREATE INDEX IF NOT EXISTS idx_client_products_responsible_employee_id ON public.client_products (responsible_employee_id);
CREATE INDEX IF NOT EXISTS idx_client_products_created_at ON public.client_products (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_product_steps_cp_id ON public.client_product_steps (client_product_id);

CREATE INDEX IF NOT EXISTS idx_clients_partner_id ON public.clients (partner_id);
CREATE INDEX IF NOT EXISTS idx_clients_referrer_id ON public.clients (referrer_id);
CREATE INDEX IF NOT EXISTS idx_clients_responsible_id ON public.clients (responsible_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_client_id ON public.sales (client_id);
CREATE INDEX IF NOT EXISTS idx_sales_partner_id ON public.sales (partner_id);
CREATE INDEX IF NOT EXISTS idx_sales_referrer_id ON public.sales (referrer_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON public.sales (product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON public.sales (sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
