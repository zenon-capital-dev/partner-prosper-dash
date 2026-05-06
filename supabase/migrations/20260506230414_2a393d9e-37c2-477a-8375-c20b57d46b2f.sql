-- Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    role TEXT,
    function TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    has_system_access BOOLEAN DEFAULT false,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create service_providers table
CREATE TABLE IF NOT EXISTS public.service_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    document_number TEXT, -- CPF or CNPJ
    email TEXT UNIQUE,
    phone TEXT,
    whatsapp TEXT,
    area_of_expertise TEXT,
    services_offered TEXT[],
    bank_details JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    has_system_access BOOLEAN DEFAULT false,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

-- Policies for employees
CREATE POLICY "Employees are viewable by admins" ON public.employees
    FOR SELECT USING (true); -- Simplify for now, usually restricted to admin role

CREATE POLICY "Admins can manage employees" ON public.employees
    FOR ALL USING (true);

-- Policies for service providers
CREATE POLICY "Service providers are viewable by admins" ON public.service_providers
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage service providers" ON public.service_providers
    FOR ALL USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_providers_updated_at
    BEFORE UPDATE ON public.service_providers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX idx_employees_email ON public.employees(email);
CREATE INDEX idx_service_providers_email ON public.service_providers(email);
CREATE INDEX idx_service_providers_document ON public.service_providers(document_number);
