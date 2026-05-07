-- Create missing tables and relationships according to the detailed spec

-- 1. Product Steps (Workflow/Stages for each product)
CREATE TABLE IF NOT EXISTS public.product_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    step_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Product Required Documents (Templates for documents needed per product)
CREATE TABLE IF NOT EXISTS public.product_required_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Notes (Centralized notes for various entities)
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Ensure Clients has references for Indicator/Responsible
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='partner_id') THEN
        ALTER TABLE public.clients ADD COLUMN partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='collaborator_id') THEN
        ALTER TABLE public.clients ADD COLUMN collaborator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Ensure Client Products has provider and status tracking
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_products' AND column_name='service_provider_id') THEN
        ALTER TABLE public.client_products ADD COLUMN service_provider_id UUID REFERENCES public.service_providers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_products' AND column_name='current_step_id') THEN
        ALTER TABLE public.client_products ADD COLUMN current_step_id UUID REFERENCES public.product_steps(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Activity Logs (Extending existing audit_logs or ensuring structure)
-- We'll use the existing audit_logs but ensure it's robust
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
    entity_type TEXT NOT NULL, -- 'client', 'document', 'contract', etc.
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. RLS for new tables
ALTER TABLE public.product_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Basic Admin access policies (Assuming 'admin' role logic exists in user_roles)
CREATE POLICY "Admins have full access to product_steps" ON public.product_steps FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins have full access to product_required_documents" ON public.product_required_documents FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can see notes they have access to" ON public.notes FOR SELECT USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can create notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can view activity logs" ON public.activity_logs FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 8. Triggers for Activity Logging (Example for clients)
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER AS $$
DECLARE
    entity_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        entity_id := OLD.id;
    ELSE
        entity_id := NEW.id;
    END IF;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        entity_id,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add logger to main tables if they don't have it
DROP TRIGGER IF EXISTS log_clients_activity ON public.clients;
CREATE TRIGGER log_clients_activity AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_documents_activity ON public.documents;
CREATE TRIGGER log_documents_activity AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_contracts_activity ON public.contracts;
CREATE TRIGGER log_contracts_activity AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.log_activity();
