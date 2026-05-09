-- Adicionar campos de controle de ajuste na demanda
ALTER TABLE public.client_products
ADD COLUMN IF NOT EXISTS adjustment_description TEXT,
ADD COLUMN IF NOT EXISTS adjustment_due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS adjustment_notes TEXT;

-- Atualizar restrição de status (se existir, se não, apenas garante que aceita os novos valores)
-- Nota: Como o campo status é TEXT, os CHECK constraints existentes precisam ser atualizados se houverem.
-- Vamos apenas garantir que o trigger de SLA e outros aceitem os novos status.

-- Tabela para histórico de controle de qualidade
CREATE TABLE IF NOT EXISTS public.client_product_quality_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_product_id UUID REFERENCES public.client_products(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL CHECK (status IN ('aprovado', 'ajuste_solicitado')),
    feedback TEXT,
    adjustment_deadline TIMESTAMP WITH TIME ZONE,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.client_product_quality_checks ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Admins can manage quality checks" ON public.client_product_quality_checks
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'admin_secondary')));

CREATE POLICY "Users can view quality checks for their products" ON public.client_product_quality_checks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.client_products cp
            WHERE cp.id = client_product_id
            AND (
                cp.service_provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid())
                OR cp.client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
            )
        )
    );

-- Trigger para registrar a conclusão automática se aprovado (opcional, faremos via UI para maior controle)
