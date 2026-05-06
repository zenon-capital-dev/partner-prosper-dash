-- Update commissions table with more detail
ALTER TABLE public.commissions 
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentual',
ADD COLUMN IF NOT EXISTS rule_value NUMERIC;

-- Ensure tasks has priority and status as requested
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'media',
ADD COLUMN IF NOT EXISTS related_entity_type TEXT,
ADD COLUMN IF NOT EXISTS related_entity_id UUID;

-- Status and priorities lists:
-- Priorities: Baixa, Média, Alta, Urgente
-- Status: Aberta, Em andamento, Aguardando terceiro, Concluída, Atrasada, Cancelada

-- Create task relations helper if needed (though we can use related_entity_type/id)
-- For now, generic related fields are enough for flexibility.
