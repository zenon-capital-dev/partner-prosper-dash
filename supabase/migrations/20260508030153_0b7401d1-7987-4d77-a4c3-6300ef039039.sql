-- Ativa extensão para busca textual
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Adiciona coluna metadata à audit_logs se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'metadata') THEN
    ALTER TABLE public.audit_logs ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_full_name ON public.leads USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON public.clients USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions (status);
CREATE INDEX IF NOT EXISTS idx_commissions_partner_id ON public.commissions (partner_id);
