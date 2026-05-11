-- 1. Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trade_name TEXT,
    document TEXT UNIQUE, -- CNPJ
    email TEXT,
    phone TEXT,
    address_zip_code TEXT,
    address_street TEXT,
    address_number TEXT,
    address_complement TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create company_contacts table
CREATE TABLE IF NOT EXISTS public.company_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Update client_products to link to companies
ALTER TABLE public.client_products 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 4. Create demand_deliveries table
CREATE TABLE IF NOT EXISTS public.demand_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_product_id UUID NOT NULL REFERENCES public.client_products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Link documents to demands
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS client_product_id UUID REFERENCES public.client_products(id) ON DELETE SET NULL;

-- 6. RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_deliveries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin view all companies" ON public.companies FOR ALL USING (true);
CREATE POLICY "Admin view all contacts" ON public.company_contacts FOR ALL USING (true);
CREATE POLICY "Admin view all deliveries" ON public.demand_deliveries FOR ALL USING (true);

-- Specific access rules
CREATE POLICY "Providers view assigned demands" 
ON public.client_products 
FOR SELECT 
USING (
    auth.uid() = responsible_provider_id -- Using id directly if responsible_provider_id is the profile/user id
);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_contacts_updated_at ON public.company_contacts;
CREATE TRIGGER update_company_contacts_updated_at BEFORE UPDATE ON public.company_contacts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_demand_deliveries_updated_at ON public.demand_deliveries;
CREATE TRIGGER update_demand_deliveries_updated_at BEFORE UPDATE ON public.demand_deliveries FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
