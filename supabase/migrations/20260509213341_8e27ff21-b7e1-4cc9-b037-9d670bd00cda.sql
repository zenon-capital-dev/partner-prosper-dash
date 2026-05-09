-- 1. Create or Update Commission Status Enum
DO $$ BEGIN
    CREATE TYPE public.commission_workflow_status AS ENUM (
        'aguardando_confirmacao',
        'pendente',
        'liberada',
        'em_pagamento',
        'paga',
        'cancelada',
        'estornada'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Commission Rules table
CREATE TABLE IF NOT EXISTS public.commission_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id UUID REFERENCES public.partners(id),
    product_id UUID REFERENCES public.products(id),
    rule_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed'
    value NUMERIC(15,2) NOT NULL DEFAULT 0,
    is_recurring BOOLEAN DEFAULT false,
    trigger_event TEXT NOT NULL DEFAULT 'first_sale', -- 'first_sale', 'renewal', 'recurrence', 'single_payment'
    release_after_payment BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Update Commissions table
ALTER TABLE public.commissions 
ADD COLUMN IF NOT EXISTS sale_value NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS applied_rule_id UUID REFERENCES public.commission_rules(id),
ADD COLUMN IF NOT EXISTS applied_rule_description TEXT,
ADD COLUMN IF NOT EXISTS expected_date DATE,
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS workflow_status public.commission_workflow_status DEFAULT 'aguardando_confirmacao';

-- 4. Enable RLS
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- 5. Policies for commission_rules
CREATE POLICY "Admins can manage commission rules" 
ON public.commission_rules FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Partners can view their own commission rules" 
ON public.commission_rules FOR SELECT 
USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));

-- 6. Trigger to release commission when payment is confirmed
CREATE OR REPLACE FUNCTION public.maybe_release_commission()
RETURNS TRIGGER AS $$
BEGIN
    -- If a payment is confirmed, find associated commissions and release them if rule says so
    IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
        UPDATE public.commissions
        SET workflow_status = 'liberada'
        WHERE sale_id = NEW.sale_id -- Assuming payments are linked to sales which are linked to commissions
        AND workflow_status = 'aguardando_confirmacao'
        AND applied_rule_id IN (SELECT id FROM public.commission_rules WHERE release_after_payment = true);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Assuming payments table exists and has sale_id or related field
-- Let's check payments columns first to be sure
