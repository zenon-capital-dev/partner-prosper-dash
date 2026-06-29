-- Performance hardening for heavily used admin tabs and RLS relationship checks.
-- These indexes target the actual predicates/orderings seen in slow PostgREST queries.

CREATE INDEX IF NOT EXISTS idx_clients_created_at_desc
  ON public.clients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_updated_status
  ON public.clients (updated_at, status);
CREATE INDEX IF NOT EXISTS idx_clients_city
  ON public.clients (city);
CREATE INDEX IF NOT EXISTS idx_clients_referrer_id
  ON public.clients (referrer_id);
CREATE INDEX IF NOT EXISTS idx_clients_service_provider_id
  ON public.clients (service_provider_id);

CREATE INDEX IF NOT EXISTS idx_partners_active_full_name
  ON public.partners (active, full_name);
CREATE INDEX IF NOT EXISTS idx_partners_email_lower
  ON public.partners (lower(email));
CREATE INDEX IF NOT EXISTS idx_partners_created_at_desc
  ON public.partners (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrers_user_id
  ON public.referrers (user_id);
CREATE INDEX IF NOT EXISTS idx_referrers_email_lower
  ON public.referrers (lower(email));

CREATE INDEX IF NOT EXISTS idx_service_providers_active_name
  ON public.service_providers (active, name);
CREATE INDEX IF NOT EXISTS idx_service_providers_email_lower
  ON public.service_providers (lower(email));
CREATE INDEX IF NOT EXISTS idx_service_providers_created_at_desc
  ON public.service_providers (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_products_deadline
  ON public.client_products (deadline);
CREATE INDEX IF NOT EXISTS idx_client_products_sla_due_date
  ON public.client_products (sla_due_date);
CREATE INDEX IF NOT EXISTS idx_client_products_end_date
  ON public.client_products (end_date);
CREATE INDEX IF NOT EXISTS idx_client_products_updated_at_desc
  ON public.client_products (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_products_status_created_desc
  ON public.client_products (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_products_status_provider
  ON public.client_products (status, service_provider_id);

CREATE INDEX IF NOT EXISTS idx_documents_client_created_desc
  ON public.documents (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_client_product_created_desc
  ON public.documents (client_product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status_created_desc
  ON public.documents (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_due_date
  ON public.documents (due_date);

CREATE INDEX IF NOT EXISTS idx_document_requests_client_created_desc
  ON public.document_requests (client_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_requests_status_requested_desc
  ON public.document_requests (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_requests_provider_status
  ON public.document_requests (provider_id, status);

CREATE INDEX IF NOT EXISTS idx_demand_deliveries_client_product_created_desc
  ON public.demand_deliveries (client_product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_deliveries_provider_status
  ON public.demand_deliveries (provider_id, status);
CREATE INDEX IF NOT EXISTS idx_demand_deliveries_created_desc
  ON public.demand_deliveries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_product_reports_product_created_desc
  ON public.client_product_status_reports (client_product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_product_reports_created_desc
  ON public.client_product_status_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_providers_client_provider
  ON public.client_providers (client_id, service_provider_id);
CREATE INDEX IF NOT EXISTS idx_client_providers_provider_client
  ON public.client_providers (service_provider_id, client_id);
CREATE INDEX IF NOT EXISTS idx_client_product_providers_product_provider
  ON public.client_product_providers (client_product_id, service_provider_id);
CREATE INDEX IF NOT EXISTS idx_client_product_providers_provider_product
  ON public.client_product_providers (service_provider_id, client_product_id);

CREATE INDEX IF NOT EXISTS idx_payments_client_due_desc
  ON public.payments (client_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_sale_status
  ON public.payments (sale_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_due_status
  ON public.payments (due_date, status);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at_status
  ON public.payments (paid_at, status);

CREATE INDEX IF NOT EXISTS idx_sales_sale_date_desc
  ON public.sales (sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status_sale_date_desc
  ON public.sales (status, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_product_sale_date_desc
  ON public.sales (product_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_referrer_sale_date_desc
  ON public.sales (referrer_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_collaborator_sale_date_desc
  ON public.sales (collaborator_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_provider_sale_date_desc
  ON public.sales (service_provider_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_revenue_sale_date_desc
  ON public.sales (revenue_type, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_due_status
  ON public.tasks (due_date, status);
CREATE INDEX IF NOT EXISTS idx_tasks_status_new_due
  ON public.tasks (status_new, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id
  ON public.tasks (client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_partner_id
  ON public.tasks (partner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_provider_id
  ON public.tasks (provider_id);
CREATE INDEX IF NOT EXISTS idx_tasks_payment_id
  ON public.tasks (payment_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contract_id
  ON public.tasks (contract_id);

CREATE INDEX IF NOT EXISTS idx_contracts_status_created_desc
  ON public.contracts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_client_id
  ON public.contracts (client_id);

CREATE INDEX IF NOT EXISTS idx_commissions_workflow_created_desc
  ON public.commissions (workflow_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_partner_id
  ON public.leads (partner_id);
CREATE INDEX IF NOT EXISTS idx_leads_responsible_id
  ON public.leads (responsible_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_desc
  ON public.leads (created_at DESC);