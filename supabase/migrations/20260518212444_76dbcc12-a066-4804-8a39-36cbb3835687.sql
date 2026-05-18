-- Tabela de interações/follow-ups com clientes (CRM diário)
CREATE TABLE IF NOT EXISTS public.client_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp', -- whatsapp | ligacao | email | reuniao | presencial | outro
  summary TEXT NOT NULL, -- o que foi falado
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- quando aconteceu
  next_action_at DATE, -- agenda para qual dia atuar de novo
  next_action_note TEXT, -- o que tem que fazer naquele dia
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | feito
  done_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_interactions_client ON public.client_interactions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_next_action ON public.client_interactions(next_action_at) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_client_interactions_occurred ON public.client_interactions(occurred_at DESC);

ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

-- Admin/colaborador veem e gerenciam tudo
CREATE POLICY "Staff manage interactions" ON public.client_interactions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_secondary'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_secondary'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

CREATE TRIGGER trg_client_interactions_updated_at
  BEFORE UPDATE ON public.client_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();