-- 1. Add standard_steps template to the main products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS standard_steps JSONB DEFAULT '[]'::jsonb;

-- 2. Enhance the client_product_steps table for operational tracking
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'step_status') THEN
    CREATE TYPE step_status AS ENUM ('pendente', 'em_andamento', 'bloqueado', 'concluido', 'cancelado');
  END IF;
END $$;

ALTER TABLE public.client_product_steps 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS status step_status DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES auth.users(id);

-- 3. RLS Policies for Checklist Items
ALTER TABLE public.client_product_steps ENABLE ROW LEVEL SECURITY;

-- ADMIN: Full access
DROP POLICY IF EXISTS "Admins can do everything on steps" ON public.client_product_steps;
CREATE POLICY "Admins can do everything on steps"
ON public.client_product_steps FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- PRESTADOR: Can view and update steps for products they are assigned to
DROP POLICY IF EXISTS "Providers can manage assigned product steps" ON public.client_product_steps;
CREATE POLICY "Providers can manage assigned product steps"
ON public.client_product_steps FOR ALL
USING (
  client_product_id IN (
    SELECT id FROM public.client_products WHERE service_provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = auth.uid()
    )
  )
);

-- CLIENTE: Can view steps for their own products
DROP POLICY IF EXISTS "Clients can view their own product steps" ON public.client_product_steps;
CREATE POLICY "Clients can view their own product steps"
ON public.client_product_steps FOR SELECT
USING (
  client_product_id IN (
    SELECT id FROM public.client_products WHERE client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  )
);
