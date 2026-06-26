
-- 07: flag de parceiro full carteira
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS is_full_carteira boolean NOT NULL DEFAULT false;

-- 09: solicitações entre prestador/parceiro/cliente
CREATE TABLE IF NOT EXISTS public.demand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_product_id uuid NOT NULL REFERENCES public.client_products(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_role text NOT NULL CHECK (requested_role IN ('admin','parceiro','prestador','cliente','colaborador')),
  target_role text NOT NULL CHECK (target_role IN ('admin','parceiro','prestador','cliente','colaborador')),
  kind text NOT NULL CHECK (kind IN ('documento','informacao','duvida','outro')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','respondida','resolvida','cancelada')),
  response text,
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_requests TO authenticated;
GRANT ALL ON public.demand_requests TO service_role;

ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;

-- Trigger preenche client_id a partir do client_product
CREATE OR REPLACE FUNCTION public.fill_demand_request_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client uuid;
BEGIN
  IF NEW.client_id IS NULL AND NEW.client_product_id IS NOT NULL THEN
    SELECT client_id INTO v_client FROM public.client_products WHERE id = NEW.client_product_id;
    NEW.client_id := v_client;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fill_demand_request_client ON public.demand_requests;
CREATE TRIGGER trg_fill_demand_request_client
BEFORE INSERT OR UPDATE ON public.demand_requests
FOR EACH ROW EXECUTE FUNCTION public.fill_demand_request_client();

DROP TRIGGER IF EXISTS trg_demand_requests_updated_at ON public.demand_requests;
CREATE TRIGGER trg_demand_requests_updated_at
BEFORE UPDATE ON public.demand_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função helper: usuário tem envolvimento com a demanda
CREATE OR REPLACE FUNCTION public.user_involved_in_demand(_user_id uuid, _client_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_products cp
    LEFT JOIN public.clients c ON c.id = cp.client_id
    LEFT JOIN public.partners p ON p.id = c.partner_id
    LEFT JOIN public.service_providers sp ON sp.id = cp.service_provider_id
    WHERE cp.id = _client_product_id
      AND (
        c.user_id = _user_id
        OR p.user_id = _user_id
        OR sp.user_id = _user_id
        OR cp.responsible_employee_id = _user_id
      )
  ) OR public.provider_has_demand_access(_user_id, _client_product_id)
$$;

CREATE POLICY "Admins gerenciam todas as solicitações"
ON public.demand_requests FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Envolvidos veem solicitações da demanda"
ON public.demand_requests FOR SELECT TO authenticated
USING (public.user_involved_in_demand(auth.uid(), client_product_id));

CREATE POLICY "Envolvidos criam solicitações"
ON public.demand_requests FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND public.user_involved_in_demand(auth.uid(), client_product_id)
);

CREATE POLICY "Envolvidos respondem solicitações"
ON public.demand_requests FOR UPDATE TO authenticated
USING (public.user_involved_in_demand(auth.uid(), client_product_id))
WITH CHECK (public.user_involved_in_demand(auth.uid(), client_product_id));

-- Notifica destinatário
CREATE OR REPLACE FUNCTION public.notify_demand_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target_user uuid;
  v_link text := '/demandas';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_role = 'cliente' THEN
      SELECT c.user_id INTO v_target_user FROM public.clients c
      JOIN public.client_products cp ON cp.client_id = c.id
      WHERE cp.id = NEW.client_product_id;
      v_link := '/portal-cliente/documentos';
    ELSIF NEW.target_role = 'parceiro' THEN
      SELECT p.user_id INTO v_target_user FROM public.partners p
      JOIN public.clients c ON c.partner_id = p.id
      JOIN public.client_products cp ON cp.client_id = c.id
      WHERE cp.id = NEW.client_product_id;
      v_link := '/parceiro';
    ELSIF NEW.target_role = 'prestador' THEN
      SELECT sp.user_id INTO v_target_user FROM public.service_providers sp
      JOIN public.client_products cp ON cp.service_provider_id = sp.id
      WHERE cp.id = NEW.client_product_id;
      v_link := '/prestador';
    ELSIF NEW.target_role = 'admin' THEN
      PERFORM public.notify_admins('Nova solicitação na demanda', NEW.title, '/demandas', 'demand_request');
      RETURN NEW;
    END IF;

    IF v_target_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, type)
      VALUES (v_target_user, 'Nova solicitação: ' || NEW.kind, NEW.title, v_link, 'demand_request');
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'respondida' AND OLD.status <> 'respondida' THEN
    IF NEW.requested_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, type)
      VALUES (NEW.requested_by, 'Solicitação respondida', NEW.title, '/demandas', 'demand_request');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_demand_request ON public.demand_requests;
CREATE TRIGGER trg_notify_demand_request
AFTER INSERT OR UPDATE ON public.demand_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_demand_request();

-- 10: esteira de atendimento global do cliente
CREATE TABLE IF NOT EXISTS public.client_journey_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6366f1',
  description text,
  is_terminal boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.client_journey_stages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.client_journey_stages TO authenticated;
GRANT ALL ON public.client_journey_stages TO service_role;

ALTER TABLE public.client_journey_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados leem estágios"
ON public.client_journey_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins gerenciam estágios"
ON public.client_journey_stages FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_journey_stages_updated_at ON public.client_journey_stages;
CREATE TRIGGER trg_journey_stages_updated_at
BEFORE UPDATE ON public.client_journey_stages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Coluna na tabela clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS journey_stage_id uuid REFERENCES public.client_journey_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS journey_updated_at timestamptz;

-- Trigger: registra no timeline ao mudar de estágio
CREATE OR REPLACE FUNCTION public.log_client_journey_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old_name text; v_new_name text;
BEGIN
  IF NEW.journey_stage_id IS DISTINCT FROM OLD.journey_stage_id THEN
    SELECT name INTO v_old_name FROM public.client_journey_stages WHERE id = OLD.journey_stage_id;
    SELECT name INTO v_new_name FROM public.client_journey_stages WHERE id = NEW.journey_stage_id;
    NEW.journey_updated_at := now();
    INSERT INTO public.client_timeline (client_id, event_type, title, description, user_id, metadata)
    VALUES (
      NEW.id, 'journey_stage_change',
      'Estágio alterado',
      COALESCE(v_old_name,'—') || ' → ' || COALESCE(v_new_name,'—'),
      auth.uid(),
      jsonb_build_object('old_stage_id', OLD.journey_stage_id, 'new_stage_id', NEW.journey_stage_id)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_client_journey ON public.clients;
CREATE TRIGGER trg_log_client_journey
BEFORE UPDATE ON public.clients
FOR EACH ROW WHEN (OLD.journey_stage_id IS DISTINCT FROM NEW.journey_stage_id)
EXECUTE FUNCTION public.log_client_journey_change();

-- Seed dos estágios iniciais (idempotente)
INSERT INTO public.client_journey_stages (name, position, color, description, is_terminal)
SELECT * FROM (VALUES
  ('Captação',       1, '#94a3b8', 'Primeiro contato e qualificação', false),
  ('Diagnóstico',    2, '#6366f1', 'Levantamento de necessidades',    false),
  ('Proposta',       3, '#8b5cf6', 'Proposta enviada / em negociação',false),
  ('Onboarding',     4, '#06b6d4', 'Documentação e ativação',         false),
  ('Em atendimento', 5, '#10b981', 'Demandas em execução',            false),
  ('Entrega',        6, '#f59e0b', 'Conclusão / entrega final',       false),
  ('Pós-venda',      7, '#3b82f6', 'Acompanhamento e novas oportunidades', true)
) AS v(name, position, color, description, is_terminal)
WHERE NOT EXISTS (SELECT 1 FROM public.client_journey_stages);

-- 09: permitir prestador anexar documento ao cliente sem aprovação
DROP POLICY IF EXISTS "Prestadores anexam docs nas suas demandas" ON public.documents;
CREATE POLICY "Prestadores anexam docs nas suas demandas"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  client_product_id IS NOT NULL
  AND public.user_involved_in_demand(auth.uid(), client_product_id)
);
