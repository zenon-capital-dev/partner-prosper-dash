-- 1. Create contract_status enum
CREATE TYPE public.contract_status AS ENUM (
    'criado', 
    'enviado', 
    'aguardando_assinatura', 
    'assinado', 
    'pendente_correcao', 
    'cancelado', 
    'finalizado'
);

-- 2. Create payment_status enum
CREATE TYPE public.payment_status AS ENUM (
    'pago', 
    'pendente', 
    'parcialmente_pago', 
    'atrasado', 
    'cancelado', 
    'reembolsado'
);

-- 3. Create contracts table
CREATE TABLE public.contracts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id),
    product_id UUID REFERENCES public.products(id),
    sale_id UUID REFERENCES public.sales(id),
    name TEXT NOT NULL,
    amount NUMERIC(15, 2),
    status public.contract_status NOT NULL DEFAULT 'criado',
    file_path TEXT,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sent_at TIMESTAMP WITH TIME ZONE,
    signed_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE
);

-- 4. Create payments table (to handle installments and manual tracking)
CREATE TABLE public.payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES public.sales(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    amount NUMERIC(15, 2) NOT NULL,
    amount_paid NUMERIC(15, 2) DEFAULT 0,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    status public.payment_status NOT NULL DEFAULT 'pendente',
    payment_method TEXT,
    installments_count INTEGER DEFAULT 1,
    installment_number INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Add triggers for updated_at
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 7. Policies (basic admin-level access for now, can be refined per role)
CREATE POLICY "Authenticated users can view contracts" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update contracts" ON public.contracts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payments" ON public.payments FOR UPDATE TO authenticated USING (true);

-- 8. Storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Authenticated users can manage contract files" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'contracts');
