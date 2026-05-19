-- Revogar execução pública de funções que manipulam dados sensíveis
REVOKE EXECUTE ON FUNCTION public.handle_new_sale FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_sale_splits FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_commission_splits FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.maybe_release_commission FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_status_report_inserted FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_client_product_provider FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_client_provider FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_client_collaborator FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_client_onboarding FROM PUBLIC;

-- Garantir que o esquema public seja seguro
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Adicionar índices para performance se não existirem
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_document ON public.clients(document);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON public.sales(client_id);
CREATE INDEX IF NOT EXISTS idx_commissions_client_id ON public.commissions(client_id);
