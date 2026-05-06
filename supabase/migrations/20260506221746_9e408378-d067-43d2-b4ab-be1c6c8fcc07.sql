-- Update partner types and status
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_type_enum') THEN
        CREATE TYPE partner_type_enum AS ENUM ('indicador', 'afiliado', 'consultoria', 'agencia', 'outro');
    END IF;
END $$;

ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_agency TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT,
ADD COLUMN IF NOT EXISTS has_system_access BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS partner_category partner_type_enum DEFAULT 'indicador',
ADD COLUMN IF NOT EXISTS default_commission_value NUMERIC;

-- Update commission status and rules
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_status_enum') THEN
        CREATE TYPE commission_status_enum AS ENUM ('gerada', 'em_analise', 'aprovada', 'paga', 'cancelada', 'bloqueada');
    END IF;
END $$;

ALTER TABLE public.commissions
ALTER COLUMN status TYPE TEXT; -- Convert temporarily if needed or just use as is

ALTER TABLE public.commissions
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id),
ADD COLUMN IF NOT EXISTS rule_type TEXT DEFAULT 'percent', -- 'percent' or 'fixed'
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reason TEXT;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_commissions_partner_status ON public.commissions(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_commissions_client ON public.commissions(client_id);
