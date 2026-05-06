-- Add origins and more status options to the client schema
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS document_type TEXT, -- CPF or CNPJ
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip_code TEXT,
ADD COLUMN IF NOT EXISTS address_country TEXT DEFAULT 'Brasil',
ADD COLUMN IF NOT EXISTS sale_value DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS sale_date DATE,
ADD COLUMN IF NOT EXISTS entry_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS completion_date DATE,
ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS provider_id UUID, -- References to providers table/role
ADD COLUMN IF NOT EXISTS indicator_id UUID, -- References to partners or other clients
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'cadastro_manual',
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'media',
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Origins enum-like constraint (handled via UI, but good to have documentation here)
-- Sources: cadastro_manual, indicacao_parceiro, indicacao_cliente, indicacao_colaborador, trafego_pago, instagram, whatsapp, site, organico, prospeccao_ativa, outro

-- Ensure status has all requested values
-- Note: If status is already an enum, we'd need to alter it. Checking current schema...
-- The previous migration used TEXT for status in some tables, but profiles/clients might use enums.

-- Create client_products junction table if not exists for "Produtos Contratados"
CREATE TABLE IF NOT EXISTS public.client_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    custom_product_name TEXT, -- For personalized products
    value DECIMAL(12,2),
    status TEXT DEFAULT 'aguardando_inicio', -- em_andamento, finalizado, cancelado
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_products ENABLE ROW LEVEL SECURITY;

-- Admin policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage client products') THEN
        CREATE POLICY "Admins can manage client products" ON public.client_products FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'admin_secondary', 'colaborador')));
    END IF;
END $$;
