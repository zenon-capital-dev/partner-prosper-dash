-- 1. Helper functions for RLS with unique names to avoid conflicts
CREATE OR REPLACE FUNCTION public.check_user_role(_user_id uuid, _role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = _user_id 
    AND (user_roles.role::text = _role OR user_roles.role::text = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = _user_id 
    AND user_roles.role::text IN ('admin', 'admin_secondary')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Comprehensive RLS for Leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage leads" ON public.leads;
CREATE POLICY "Admins manage leads" 
ON public.leads FOR ALL 
USING (check_is_admin(auth.uid()) OR check_user_role(auth.uid(), 'vendedor'));

DROP POLICY IF EXISTS "Partners view own leads" ON public.leads;
CREATE POLICY "Partners view own leads" 
ON public.leads FOR SELECT 
USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));

-- 3. Comprehensive RLS for Commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage commissions" ON public.commissions;
CREATE POLICY "Admins manage commissions" 
ON public.commissions FOR ALL 
USING (check_is_admin(auth.uid()));

DROP POLICY IF EXISTS "Partners view own commissions" ON public.commissions;
CREATE POLICY "Partners view own commissions" 
ON public.commissions FOR SELECT 
USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));

-- 4. Comprehensive RLS for Contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage contracts" ON public.contracts;
CREATE POLICY "Admins manage contracts" 
ON public.contracts FOR ALL 
USING (check_is_admin(auth.uid()));

DROP POLICY IF EXISTS "Clients view own contracts" ON public.contracts;
CREATE POLICY "Clients view own contracts" 
ON public.contracts FOR SELECT 
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- 5. Comprehensive RLS for Client Products (Demandas)
ALTER TABLE public.client_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all products" ON public.client_products;
CREATE POLICY "Admins manage all products" 
ON public.client_products FOR ALL 
USING (check_is_admin(auth.uid()) OR check_user_role(auth.uid(), 'colaborador'));

DROP POLICY IF EXISTS "Clients view own products" ON public.client_products;
CREATE POLICY "Clients view own products" 
ON public.client_products FOR SELECT 
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Providers view assigned products" ON public.client_products;
CREATE POLICY "Providers view assigned products" 
ON public.client_products FOR SELECT 
USING (service_provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Providers update assigned products" ON public.client_products;
CREATE POLICY "Providers update assigned products" 
ON public.client_products FOR UPDATE 
USING (service_provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid()));

-- 6. Comprehensive RLS for Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage tasks" ON public.tasks;
CREATE POLICY "Admins manage tasks" 
ON public.tasks FOR ALL 
USING (check_is_admin(auth.uid()) OR check_user_role(auth.uid(), 'colaborador'));

DROP POLICY IF EXISTS "Users view assigned tasks" ON public.tasks;
CREATE POLICY "Users view assigned tasks" 
ON public.tasks FOR SELECT 
USING (assigned_to = auth.uid());

-- 7. Audit and Timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to major tables
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('clients', 'leads', 'partners', 'commissions', 'contracts', 'client_products', 'tasks', 'documents', 'profiles')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
    END LOOP;
END $$;
