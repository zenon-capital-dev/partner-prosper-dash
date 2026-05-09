-- 1. Ensure the column exists and has proper indexing
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'client_product_id') THEN
    ALTER TABLE public.documents ADD COLUMN client_product_id UUID REFERENCES public.client_products(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_client_product_id ON public.documents(client_product_id);

-- 2. Update RLS Policies for Service Providers

-- Enable RLS on core tables (just in case)
ALTER TABLE public.client_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- CLIENT_PRODUCTS POLICIES
DROP POLICY IF EXISTS "Providers view assigned products" ON public.client_products;
CREATE POLICY "Providers view assigned products"
ON public.client_products FOR SELECT
USING (
  service_provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = auth.uid()
  ) OR public.is_admin()
);

-- DOCUMENTS POLICIES
DROP POLICY IF EXISTS "Providers view assigned product documents" ON public.documents;
CREATE POLICY "Providers view assigned product documents"
ON public.documents FOR SELECT
USING (
  client_product_id IN (
    SELECT id FROM public.client_products 
    WHERE service_provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = auth.uid()
    )
  ) OR public.is_admin()
);

-- 3. Ensure Client can see their own product-linked documents
DROP POLICY IF EXISTS "Clients view own documents" ON public.documents;
CREATE POLICY "Clients view own documents"
ON public.documents FOR SELECT
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  ) OR public.is_admin()
);

-- 4. Update Partner policies for better isolation
DROP POLICY IF EXISTS "Partners view their clients" ON public.clients;
CREATE POLICY "Partners view their clients"
ON public.clients FOR SELECT
USING (
  partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid()
  ) OR public.is_admin()
);

DROP POLICY IF EXISTS "Partners view own commissions" ON public.commissions;
CREATE POLICY "Partners view own commissions"
ON public.commissions FOR SELECT
USING (
  partner_id IN (
    SELECT id FROM public.partners WHERE user_id = auth.uid()
  ) OR public.is_admin()
);
