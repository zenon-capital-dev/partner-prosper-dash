-- Update products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'unico', -- 'unico', 'mensal', 'anual'
ADD COLUMN IF NOT EXISTS default_employee_commission NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_provider_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS required_documents JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS standard_steps JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS avg_delivery_time INTEGER; -- in days

-- Update client_products table (or create if not exactly matching)
-- If it already exists, we ensure the columns are correct.
ALTER TABLE public.client_products 
ADD COLUMN IF NOT EXISTS custom_value NUMERIC,
ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS partner_commission NUMERIC,
ADD COLUMN IF NOT EXISTS employee_commission NUMERIC,
ADD COLUMN IF NOT EXISTS responsible_employee_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS responsible_provider_id UUID REFERENCES public.service_providers(id),
ADD COLUMN IF NOT EXISTS deadline DATE,
ADD COLUMN IF NOT EXISTS required_documents JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS current_steps JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Ensure categories exist
INSERT INTO public.product_categories (name, slug)
VALUES 
('Gestão financeira', 'gestao-financeira'),
('Jurídico', 'juridico'),
('Consultoria', 'consultoria'),
('Regularização', 'regularizacao'),
('Documentação', 'documentacao'),
('Serviços administrativos', 'servicos-administrativos'),
('Contabilidade', 'contabilidade'),
('Planejamento', 'planejamento'),
('Outros', 'outros')
ON CONFLICT (slug) DO NOTHING;

-- Trigger for updated_at on client_products
CREATE OR REPLACE FUNCTION update_client_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_client_products_updated_at ON public.client_products;
CREATE TRIGGER tr_client_products_updated_at
    BEFORE UPDATE ON public.client_products
    FOR EACH ROW
    EXECUTE FUNCTION update_client_products_updated_at();
