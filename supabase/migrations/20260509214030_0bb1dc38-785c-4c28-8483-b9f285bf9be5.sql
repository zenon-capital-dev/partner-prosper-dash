-- Add new statuses to the enum if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'contract_status' AND pg_enum.enumlabel = 'rascunho') THEN
        ALTER TYPE public.contract_status ADD VALUE 'rascunho';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'contract_status' AND pg_enum.enumlabel = 'vencido') THEN
        ALTER TYPE public.contract_status ADD VALUE 'vencido';
    END IF;
END $$;

-- Add new columns to contracts table
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.service_providers(id),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contract_type TEXT CHECK (contract_type IN (
    'cliente', 
    'parceiro', 
    'prestador', 
    'produto', 
    'termo_servico', 
    'procuracao', 
    'termo_confidencialidade'
));

-- Ensure RLS is enabled
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if any (admin policies usually exist)
-- We will add specific policies for entities

DROP POLICY IF EXISTS "Service providers can view their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Partners can view their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Clients can view their own contracts" ON public.contracts;

-- Add policies for service providers to see their own contracts
CREATE POLICY "Service providers can view their own contracts" 
ON public.contracts 
FOR SELECT 
USING (
    auth.uid() IN (
        SELECT user_id FROM public.service_providers WHERE id = contracts.provider_id
    )
);

-- Partners can view their own contracts
CREATE POLICY "Partners can view their own contracts" 
ON public.contracts 
FOR SELECT 
USING (
    auth.uid() IN (
        SELECT user_id FROM public.partners WHERE id = contracts.partner_id
    )
);

-- Clients can view their own contracts
CREATE POLICY "Clients can view their own contracts" 
ON public.contracts 
FOR SELECT 
USING (
    auth.uid() IN (
        SELECT user_id FROM public.clients WHERE id = contracts.client_id
    )
);
