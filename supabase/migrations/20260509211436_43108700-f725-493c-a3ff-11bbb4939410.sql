-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table: public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin());

-- Table: public.clients (Assuming this links users to partners/providers)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own data" ON public.clients;
CREATE POLICY "Clients view own data"
ON public.clients FOR SELECT
USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Partners view their clients" ON public.clients;
CREATE POLICY "Partners view their clients"
ON public.clients FOR SELECT
USING (partner_id = auth.uid() OR public.is_admin());

-- Table: public.client_products
ALTER TABLE public.client_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own products" ON public.client_products;
CREATE POLICY "Clients view own products"
ON public.client_products FOR SELECT
USING (client_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Providers view assigned products" ON public.client_products;
CREATE POLICY "Providers view assigned products"
ON public.client_products FOR SELECT
USING (service_provider_id = auth.uid() OR public.is_admin());

-- Table: public.documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own documents" ON public.documents;
CREATE POLICY "Clients view own documents"
ON public.documents FOR SELECT
USING (client_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Providers view assigned product documents" ON public.documents;
CREATE POLICY "Providers view assigned product documents"
ON public.documents FOR SELECT
USING (
  client_product_id IN (
    SELECT id FROM public.client_products WHERE service_provider_id = auth.uid()
  ) OR public.is_admin()
);

-- Table: public.commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners view own commissions" ON public.commissions;
CREATE POLICY "Partners view own commissions"
ON public.commissions FOR SELECT
USING (partner_id = auth.uid() OR public.is_admin());
