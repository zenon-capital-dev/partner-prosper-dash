
-- ===== Indicadores =====
CREATE TABLE public.referrers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  email text,
  phone text,
  document text,
  pix_key text,
  commission_percent numeric NOT NULL DEFAULT 5,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/vendedor manage referrers" ON public.referrers
  FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role));

CREATE POLICY "Referrer views own" ON public.referrers
  FOR SELECT USING (user_id = auth.uid());

CREATE TRIGGER trg_referrers_updated BEFORE UPDATE ON public.referrers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Colunas em clients =====
ALTER TABLE public.clients
  ADD COLUMN referrer_id uuid REFERENCES public.referrers(id) ON DELETE SET NULL,
  ADD COLUMN collaborator_id uuid;

-- ===== Colunas em sales =====
ALTER TABLE public.sales
  ADD COLUMN referrer_id uuid REFERENCES public.referrers(id) ON DELETE SET NULL,
  ADD COLUMN collaborator_id uuid,
  ADD COLUMN referrer_percent numeric DEFAULT 0,
  ADD COLUMN collaborator_percent numeric DEFAULT 0;

-- ===== Splits de comissão =====
CREATE TYPE public.beneficiary_type AS ENUM ('partner','referrer','collaborator');
CREATE TYPE public.split_status AS ENUM ('pendente','pago','cancelado');

CREATE TABLE public.commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  beneficiary_type public.beneficiary_type NOT NULL,
  beneficiary_id uuid NOT NULL,
  percent numeric NOT NULL,
  amount numeric NOT NULL,
  status public.split_status NOT NULL DEFAULT 'pendente',
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_splits_sale ON public.commission_splits(sale_id);
CREATE INDEX idx_splits_beneficiary ON public.commission_splits(beneficiary_type, beneficiary_id);

ALTER TABLE public.commission_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage splits" ON public.commission_splits
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin/vendedor view splits" ON public.commission_splits
  FOR SELECT USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role));

CREATE POLICY "Partner view own splits" ON public.commission_splits
  FOR SELECT USING (
    beneficiary_type = 'partner' AND beneficiary_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
  );

CREATE POLICY "Referrer view own splits" ON public.commission_splits
  FOR SELECT USING (
    beneficiary_type = 'referrer' AND beneficiary_id IN (SELECT id FROM referrers WHERE user_id = auth.uid())
  );

CREATE POLICY "Collaborator view own splits" ON public.commission_splits
  FOR SELECT USING (beneficiary_type = 'collaborator' AND beneficiary_id = auth.uid());

CREATE TRIGGER trg_splits_updated BEFORE UPDATE ON public.commission_splits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Trigger: gera splits automaticamente ao criar uma venda =====
CREATE OR REPLACE FUNCTION public.generate_commission_splits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent,0) > 0 THEN
    INSERT INTO public.commission_splits(sale_id, beneficiary_type, beneficiary_id, percent, amount)
    VALUES (NEW.id, 'partner', NEW.partner_id, NEW.commission_percent,
            ROUND(NEW.amount * NEW.commission_percent / 100, 2));
  END IF;

  IF NEW.referrer_id IS NOT NULL AND COALESCE(NEW.referrer_percent,0) > 0 THEN
    INSERT INTO public.commission_splits(sale_id, beneficiary_type, beneficiary_id, percent, amount)
    VALUES (NEW.id, 'referrer', NEW.referrer_id, NEW.referrer_percent,
            ROUND(NEW.amount * NEW.referrer_percent / 100, 2));
  END IF;

  IF NEW.collaborator_id IS NOT NULL AND COALESCE(NEW.collaborator_percent,0) > 0 THEN
    INSERT INTO public.commission_splits(sale_id, beneficiary_type, beneficiary_id, percent, amount)
    VALUES (NEW.id, 'collaborator', NEW.collaborator_id, NEW.collaborator_percent,
            ROUND(NEW.amount * NEW.collaborator_percent / 100, 2));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_generate_splits
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.generate_commission_splits();

-- ===== Assinaturas / Produtos contratados =====
CREATE TYPE public.subscription_status AS ENUM ('ativa','pausada','cancelada','inadimplente');
CREATE TYPE public.billing_cycle AS ENUM ('mensal','trimestral','semestral','anual','unico');

CREATE TABLE public.client_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  custom_name text,
  amount numeric NOT NULL DEFAULT 0,
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'mensal',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date date,
  end_date date,
  status public.subscription_status NOT NULL DEFAULT 'ativa',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subs_client ON public.client_subscriptions(client_id);
CREATE INDEX idx_subs_status ON public.client_subscriptions(status);
CREATE INDEX idx_subs_next ON public.client_subscriptions(next_billing_date);

ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/vendedor manage subscriptions" ON public.client_subscriptions
  FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role));

CREATE POLICY "Client views own subscriptions" ON public.client_subscriptions
  FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
