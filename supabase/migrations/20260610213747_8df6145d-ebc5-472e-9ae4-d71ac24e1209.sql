
-- Add 'sem_atuacao' status to task status enum
ALTER TYPE public.task_status_new ADD VALUE IF NOT EXISTS 'sem_atuacao';

-- Fix FK from payments.sale_id to cascade on delete (was restrict)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_sale_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

-- Add service_provider_id to sales for prestador (repasse) tracking
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS service_provider_id uuid REFERENCES public.service_providers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_service_provider_id ON public.sales(service_provider_id);
