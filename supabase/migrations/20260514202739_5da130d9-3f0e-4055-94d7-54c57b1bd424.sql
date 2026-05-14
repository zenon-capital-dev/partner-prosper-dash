-- Tabela de atuações diárias agendadas
CREATE TABLE public.daily_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  client_product_id UUID,
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | executada | cancelada
  result TEXT, -- contatado | sem_resposta | fechado | reagendar | null
  notes TEXT,
  execution_notes TEXT,
  priority TEXT NOT NULL DEFAULT 'normal', -- baixa | normal | alta
  assigned_to UUID, -- futuro: colaborador responsável
  created_by UUID,
  executed_by UUID,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_actions_scheduled_date ON public.daily_actions(scheduled_date);
CREATE INDEX idx_daily_actions_client_id ON public.daily_actions(client_id);
CREATE INDEX idx_daily_actions_status ON public.daily_actions(status);
CREATE INDEX idx_daily_actions_assigned_to ON public.daily_actions(assigned_to);

ALTER TABLE public.daily_actions ENABLE ROW LEVEL SECURITY;

-- Admin total
CREATE POLICY "Admins manage daily actions"
ON public.daily_actions
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

-- Colaborador / vendedor visualizam (preparado para futuro)
CREATE POLICY "Internal team views daily actions"
ON public.daily_actions
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'colaborador'::app_role)
  OR private.has_role(auth.uid(), 'vendedor'::app_role)
  OR private.has_role(auth.uid(), 'admin_secondary'::app_role)
);

-- Trigger updated_at
CREATE TRIGGER update_daily_actions_updated_at
BEFORE UPDATE ON public.daily_actions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();