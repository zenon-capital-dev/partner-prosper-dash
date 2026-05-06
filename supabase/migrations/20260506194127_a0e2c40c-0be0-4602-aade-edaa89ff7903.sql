-- Update profiles table with more fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT;

-- Service Providers (Prestadores de Serviço)
CREATE TABLE IF NOT EXISTS public.service_providers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    document_number TEXT,
    specialty TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Service Assignments (Controle operacional de tarefas/serviços)
CREATE TABLE IF NOT EXISTS public.service_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    provider_id UUID REFERENCES public.service_providers(id),
    collaborator_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for service_providers
CREATE POLICY "Admins manage service providers" 
ON public.service_providers FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Internal team can view service providers" 
ON public.service_providers FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'vendedor', 'colaborador')));

-- Policies for service_assignments
CREATE POLICY "Admins manage assignments" 
ON public.service_assignments FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Internal team can view assignments" 
ON public.service_assignments FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'vendedor', 'colaborador', 'prestador')));

-- Extend sales and projects
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2);

-- Automated updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_service_providers_updated_at ON public.service_providers;
CREATE TRIGGER tr_service_providers_updated_at 
    BEFORE UPDATE ON public.service_providers 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS tr_service_assignments_updated_at ON public.service_assignments;
CREATE TRIGGER tr_service_assignments_updated_at 
    BEFORE UPDATE ON public.service_assignments 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
