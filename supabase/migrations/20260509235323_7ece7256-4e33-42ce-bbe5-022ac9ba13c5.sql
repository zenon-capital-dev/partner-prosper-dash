-- Tabela para histórico de pausas
CREATE TABLE IF NOT EXISTS public.client_product_pauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_product_id UUID REFERENCES public.client_products(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN (
        'cliente_nao_enviou_documentos',
        'aguardando_assinatura',
        'aguardando_pagamento',
        'aguardando_retorno_terceiro',
        'aguardando_decisao_interna',
        'outro'
    )),
    notes TEXT,
    paused_by UUID REFERENCES auth.users(id),
    paused_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    resumed_at TIMESTAMP WITH TIME ZONE,
    freeze_sla BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para registro de motivos de atraso
CREATE TABLE IF NOT EXISTS public.client_product_delays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_product_id UUID REFERENCES public.client_products(id) ON DELETE CASCADE,
    delay_reason_category TEXT NOT NULL CHECK (delay_reason_category IN (
        'cliente',
        'prestador',
        'admin',
        'terceiro',
        'pagamento',
        'documento',
        'contrato'
    )),
    description TEXT NOT NULL,
    recorded_by UUID REFERENCES auth.users(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar flag de congelamento de SLA na demanda
ALTER TABLE public.client_products 
ADD COLUMN IF NOT EXISTS is_sla_frozen BOOLEAN DEFAULT false;

-- Habilitar RLS
ALTER TABLE public.client_product_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_product_delays ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso baseadas na tabela user_roles (com nomes de roles corrigidos)
CREATE POLICY "Admins can manage pauses" ON public.client_product_pauses
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'admin_secondary')));

CREATE POLICY "Admins can manage delays" ON public.client_product_delays
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'admin_secondary')));

-- Trigger para atualizar status da demanda ao pausar
CREATE OR REPLACE FUNCTION public.handle_demand_pause()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.resumed_at IS NULL THEN
        UPDATE public.client_products 
        SET status = 'pausado', 
            is_sla_frozen = NEW.freeze_sla
        WHERE id = NEW.client_product_id;
    ELSE
        UPDATE public.client_products 
        SET status = 'em_execucao',
            is_sla_frozen = false
        WHERE id = NEW.client_product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_handle_demand_pause
AFTER INSERT OR UPDATE ON public.client_product_pauses
FOR EACH ROW EXECUTE FUNCTION public.handle_demand_pause();
