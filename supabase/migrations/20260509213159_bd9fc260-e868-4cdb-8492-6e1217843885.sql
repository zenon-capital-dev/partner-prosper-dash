-- 1. Extend payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_period TEXT,
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;

-- 2. Add new statuses to enum
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'parcial' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')) THEN
    ALTER TYPE payment_status ADD VALUE 'parcial';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'reembolsado' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')) THEN
    ALTER TYPE payment_status ADD VALUE 'reembolsado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cancelado' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')) THEN
    ALTER TYPE payment_status ADD VALUE 'cancelado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'vencido' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')) THEN
    ALTER TYPE payment_status ADD VALUE 'vencido';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'em_aberto' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')) THEN
    ALTER TYPE payment_status ADD VALUE 'em_aberto';
  END IF;
END $$;

-- 3. Financial alerts table
CREATE TABLE IF NOT EXISTS public.financial_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  commission_id UUID REFERENCES public.commissions(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage financial alerts" ON public.financial_alerts;
CREATE POLICY "Admins manage financial alerts"
ON public.financial_alerts FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_alerts_type ON public.financial_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_financial_alerts_is_read ON public.financial_alerts(is_read);