-- 1. Tabela para solicitações de documentos
CREATE TABLE IF NOT EXISTS public.client_document_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'aprovado', 'rejeitado')),
    due_date DATE,
    file_url TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabela para checklist de entrega de produtos (etapas)
CREATE TABLE IF NOT EXISTS public.client_product_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_product_id UUID NOT NULL REFERENCES public.client_products(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tabela de histórico de splits de comissão (Auditoria)
CREATE TABLE IF NOT EXISTS public.commission_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('partner', 'referrer', 'company')),
    entity_id UUID, -- NULL se for company
    amount DECIMAL(12,2) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_product_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_splits ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Simplified for admin context)
CREATE POLICY "Enable all for authenticated users" ON public.client_document_requests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.client_product_steps FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.commission_splits FOR ALL USING (auth.role() = 'authenticated');

-- Function to handle splits on sale creation
CREATE OR REPLACE FUNCTION public.handle_sale_splits()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_amount DECIMAL(12,2);
    v_referrer_amount DECIMAL(12,2);
    v_company_amount DECIMAL(12,2);
BEGIN
    -- Calculate Amounts
    v_partner_amount := (NEW.amount * COALESCE(NEW.commission_percent, 0)) / 100;
    v_referrer_amount := (NEW.amount * COALESCE(NEW.referrer_percent, 0)) / 100;
    v_company_amount := NEW.amount - v_partner_amount - v_referrer_amount;

    -- Insert Partner Split
    IF NEW.partner_id IS NOT NULL AND v_partner_amount > 0 THEN
        INSERT INTO public.commission_splits (sale_id, entity_type, entity_id, amount, percentage)
        VALUES (NEW.id, 'partner', NEW.partner_id, v_partner_amount, NEW.commission_percent);
    END IF;

    -- Insert Referrer Split
    IF NEW.referrer_id IS NOT NULL AND v_referrer_amount > 0 THEN
        INSERT INTO public.commission_splits (sale_id, entity_type, entity_id, amount, percentage)
        VALUES (NEW.id, 'referrer', NEW.referrer_id, v_referrer_amount, NEW.referrer_percent);
    END IF;

    -- Insert Company Split
    INSERT INTO public.commission_splits (sale_id, entity_type, entity_id, amount, percentage)
    VALUES (NEW.id, 'company', NULL, v_company_amount, 100 - COALESCE(NEW.commission_percent, 0) - COALESCE(NEW.referrer_percent, 0));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sale_created_splits
    AFTER INSERT ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.handle_sale_splits();
