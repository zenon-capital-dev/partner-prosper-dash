-- RLS Refinement for Companies
DROP POLICY IF EXISTS "Admin view all companies" ON public.companies;
CREATE POLICY "Admins can do everything with companies" ON public.companies FOR ALL USING (true);
CREATE POLICY "Clients can view their own companies" ON public.companies FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- RLS Refinement for Company Contacts
DROP POLICY IF EXISTS "Admin view all contacts" ON public.company_contacts;
CREATE POLICY "Admins can do everything with company contacts" ON public.company_contacts FOR ALL USING (true);
CREATE POLICY "Clients can view their company contacts" ON public.company_contacts FOR SELECT USING (
    company_id IN (
        SELECT id FROM public.companies WHERE client_id IN (
            SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
    )
);

-- RLS Refinement for Client Products (Demands)
DROP POLICY IF EXISTS "Providers view assigned demands" ON public.client_products;
CREATE POLICY "Admins manage all demands" ON public.client_products FOR ALL USING (true);

-- Provider Specific: Access to assigned demands
CREATE POLICY "Providers access assigned demands" 
ON public.client_products 
FOR ALL 
USING (
    service_provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid())
    OR responsible_provider_id = auth.uid()
);

-- Client Specific: Access to their own demands
CREATE POLICY "Clients access their own demands" 
ON public.client_products 
FOR SELECT 
USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR company_id IN (SELECT id FROM public.companies WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
);

-- Partner Specific: Access to their referrals
CREATE POLICY "Partners access their referrals" 
ON public.client_products 
FOR SELECT 
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
        OR referrer_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    )
);

-- Documents RLS Refinement
CREATE POLICY "Access documents through demands" 
ON public.documents 
FOR SELECT 
USING (
    client_product_id IN (
        SELECT id FROM public.client_products
    ) -- Logic is inherited by client_products RLS if we used security definer or similar, but here we need explicit check
);
