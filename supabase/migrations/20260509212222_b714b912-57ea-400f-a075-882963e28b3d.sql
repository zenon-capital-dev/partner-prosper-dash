-- 1. Extend client_products with priority and deeper operational tracking
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'demand_priority') THEN
    CREATE TYPE demand_priority AS ENUM ('baixa', 'normal', 'alta', 'urgente');
  END IF;
END $$;

ALTER TABLE public.client_products 
ADD COLUMN IF NOT EXISTS priority demand_priority DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;

-- 2. Ensure indexes for Demand center filtering
CREATE INDEX IF NOT EXISTS idx_client_products_status ON public.client_products(status);
CREATE INDEX IF NOT EXISTS idx_client_products_priority ON public.client_products(priority);
CREATE INDEX IF NOT EXISTS idx_client_products_service_provider_id ON public.client_products(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_client_products_client_id ON public.client_products(client_id);
