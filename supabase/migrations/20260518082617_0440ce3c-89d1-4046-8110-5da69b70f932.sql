-- Provider Atuação: interactions log + daily schedule

CREATE OR REPLACE FUNCTION public.is_provider_owner(_user_id uuid, _provider_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.service_providers WHERE id = _provider_id AND user_id = _user_id);
$$;

CREATE TABLE public.provider_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_product_id uuid REFERENCES public.client_products(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  direction text NOT NULL DEFAULT 'outbound',
  summary text NOT NULL,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  next_action text,
  next_action_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prov_inter_provider ON public.provider_interactions(provider_id);
CREATE INDEX idx_prov_inter_client ON public.provider_interactions(client_id);
CREATE INDEX idx_prov_inter_occurred ON public.provider_interactions(occurred_at DESC);

CREATE TRIGGER trg_prov_inter_upd BEFORE UPDATE ON public.provider_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.provider_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provider manages own interactions" ON public.provider_interactions
  FOR ALL TO authenticated
  USING (public.is_provider_owner(auth.uid(), provider_id) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_provider_owner(auth.uid(), provider_id) OR public.is_admin(auth.uid()));

CREATE TABLE public.provider_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_product_id uuid REFERENCES public.client_products(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  scheduled_time time,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pendente',
  priority text NOT NULL DEFAULT 'normal',
  completed_at timestamptz,
  completion_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prov_sched_provider_date ON public.provider_schedule(provider_id, scheduled_date);
CREATE INDEX idx_prov_sched_client ON public.provider_schedule(client_id);
CREATE INDEX idx_prov_sched_status ON public.provider_schedule(status);

CREATE TRIGGER trg_prov_sched_upd BEFORE UPDATE ON public.provider_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.provider_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provider manages own schedule" ON public.provider_schedule
  FOR ALL TO authenticated
  USING (public.is_provider_owner(auth.uid(), provider_id) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_provider_owner(auth.uid(), provider_id) OR public.is_admin(auth.uid()));