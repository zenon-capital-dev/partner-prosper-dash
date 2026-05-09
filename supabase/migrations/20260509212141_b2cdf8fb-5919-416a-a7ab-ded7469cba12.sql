-- 1. Redefine RLS Policies with strict hierarchy

-- PRESTADORES (Service Providers)
-- Can ONLY see client_products they are assigned to
DROP POLICY IF EXISTS "Providers view assigned products" ON public.client_products;
CREATE POLICY "Providers view assigned products"
ON public.client_products FOR SELECT
USING (
  service_provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Can ONLY see documents linked to their assigned products
DROP POLICY IF EXISTS "Providers view assigned product documents" ON public.documents;
CREATE POLICY "Providers view assigned product documents"
ON public.documents FOR SELECT
USING (
  client_product_id IN (
    SELECT id FROM public.client_products 
    WHERE service_provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = auth.uid()
    )
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- CLIENTES (Clients)
-- Can see all their own products
DROP POLICY IF EXISTS "Clients view own products" ON public.client_products;
CREATE POLICY "Clients view own products"
ON public.client_products FOR SELECT
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Can see documents linked to their profile
DROP POLICY IF EXISTS "Clients view own documents" ON public.documents;
CREATE POLICY "Clients view own documents"
ON public.documents FOR SELECT
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 2. Status Reports Isolation
ALTER TABLE public.client_product_status_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers see own reports" ON public.client_product_status_reports;
CREATE POLICY "Providers see own reports"
ON public.client_product_status_reports FOR SELECT
USING (
  client_product_id IN (
    SELECT id FROM public.client_products 
    WHERE service_provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = auth.uid()
    )
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Clients see their product reports" ON public.client_product_status_reports;
CREATE POLICY "Clients see their product reports"
ON public.client_product_status_reports FOR SELECT
USING (
  client_product_id IN (
    SELECT id FROM public.client_products 
    WHERE client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);
