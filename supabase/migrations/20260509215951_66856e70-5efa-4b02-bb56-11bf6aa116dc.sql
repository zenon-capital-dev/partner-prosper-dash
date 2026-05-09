CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage automation rules"
ON public.automation_rules FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  trigger_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  payload JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view automation logs"
ON public.automation_logs FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "System inserts automation logs"
ON public.automation_logs FOR INSERT
WITH CHECK (true);

CREATE TRIGGER trg_automation_rules_updated
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.automation_rules (trigger_key, name, description, is_active) VALUES
  ('document_uploaded', 'Documento enviado pelo cliente', 'Notifica Admin e prestador responsável quando o cliente envia um documento.', true),
  ('document_rejected', 'Documento rejeitado', 'Notifica o cliente quando um documento é rejeitado.', true),
  ('demand_stale', 'Demanda sem atualização', 'Alerta o Admin quando uma demanda fica sem atualização por X dias.', true),
  ('payment_confirmed', 'Pagamento confirmado', 'Libera automaticamente as comissões vinculadas ao pagamento.', true),
  ('commission_paid', 'Comissão paga', 'Notifica o parceiro quando sua comissão é paga.', true),
  ('demand_deadline_near', 'Prazo da demanda próximo', 'Alerta o prestador quando o prazo da demanda está próximo.', true),
  ('client_product_added', 'Produto adicionado ao cliente', 'Cria checklist e documentos padrão automaticamente.', true),
  ('lead_converted', 'Lead convertido em cliente', 'Cria tarefas iniciais para o cliente recém-convertido.', true)
ON CONFLICT (trigger_key) DO NOTHING;