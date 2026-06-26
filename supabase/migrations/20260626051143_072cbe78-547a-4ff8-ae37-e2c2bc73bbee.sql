
-- Promover dono atual a super_admin (ajuste o e-mail se necessário)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users WHERE email = 'admin@admin.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::public.app_role
  )
$$;

-- ============ METAS COMERCIAIS ============
CREATE TABLE IF NOT EXISTS public.sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('leads','proposals','sales_count','revenue')),
  target_value numeric(14,2) NOT NULL DEFAULT 0,
  responsible_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_goals_unique_idx
  ON public.sales_goals (period_month, goal_type, COALESCE(responsible_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_goals TO authenticated;
GRANT ALL ON public.sales_goals TO service_role;
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_goals admin all" ON public.sales_goals FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER set_sales_goals_updated_at BEFORE UPDATE ON public.sales_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CAIXINHAS ============
CREATE TABLE IF NOT EXISTS public.resource_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pool_type text NOT NULL DEFAULT 'geral',
  description text,
  target_amount numeric(14,2) DEFAULT 0,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  funding_rule jsonb DEFAULT '{}'::jsonb,
  color text DEFAULT '#6366F1',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_pools TO authenticated;
GRANT ALL ON public.resource_pools TO service_role;
ALTER TABLE public.resource_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pools admin all" ON public.resource_pools FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER set_resource_pools_updated_at BEFORE UPDATE ON public.resource_pools FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.resource_pool_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.resource_pools(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada','saida','ajuste')),
  amount numeric(14,2) NOT NULL,
  description text,
  reference_type text,
  reference_id uuid,
  occurred_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_pool_movements TO authenticated;
GRANT ALL ON public.resource_pool_movements TO service_role;
ALTER TABLE public.resource_pool_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pool movements admin all" ON public.resource_pool_movements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_pool_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_delta numeric(14,2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := CASE NEW.movement_type WHEN 'entrada' THEN NEW.amount WHEN 'saida' THEN -NEW.amount ELSE NEW.amount END;
    UPDATE public.resource_pools SET current_balance = current_balance + v_delta, updated_at = now() WHERE id = NEW.pool_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := CASE OLD.movement_type WHEN 'entrada' THEN -OLD.amount WHEN 'saida' THEN OLD.amount ELSE -OLD.amount END;
    UPDATE public.resource_pools SET current_balance = current_balance + v_delta, updated_at = now() WHERE id = OLD.pool_id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_apply_pool_movement ON public.resource_pool_movements;
CREATE TRIGGER trg_apply_pool_movement AFTER INSERT OR DELETE ON public.resource_pool_movements FOR EACH ROW EXECUTE FUNCTION public.apply_pool_movement();

-- ============ DEMAND SHARES ============
CREATE TABLE IF NOT EXISTS public.demand_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_product_id uuid NOT NULL REFERENCES public.client_products(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'convidado' CHECK (status IN ('convidado','visualizou','aceitou','recusou','revogado')),
  can_download boolean NOT NULL DEFAULT true,
  message text,
  viewed_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_product_id, provider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_shares TO authenticated;
GRANT ALL ON public.demand_shares TO service_role;
ALTER TABLE public.demand_shares ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_demand_shares_updated_at BEFORE UPDATE ON public.demand_shares FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "demand_shares admin all" ON public.demand_shares FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "demand_shares provider self select" ON public.demand_shares FOR SELECT TO authenticated
  USING (provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid()));
CREATE POLICY "demand_shares provider self update" ON public.demand_shares FOR UPDATE TO authenticated
  USING (provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid()))
  WITH CHECK (provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.provider_has_demand_access(_user_id uuid, _client_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demand_shares ds
    JOIN public.service_providers sp ON sp.id = ds.provider_id
    WHERE ds.client_product_id = _client_product_id
      AND sp.user_id = _user_id
      AND ds.status IN ('convidado','visualizou','aceitou')
  )
$$;

CREATE POLICY "documents provider via demand_share" ON public.documents FOR SELECT TO authenticated
  USING (client_product_id IS NOT NULL AND public.provider_has_demand_access(auth.uid(), client_product_id));
CREATE POLICY "client_products provider via demand_share" ON public.client_products FOR SELECT TO authenticated
  USING (public.provider_has_demand_access(auth.uid(), id));

-- ============ ORIGEM DOS DOCUMENTOS ============
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'client_upload'
    CHECK (source IN ('client_upload','admin_upload','email','whatsapp','provider_upload','imported'));
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='documents admin insert any') THEN
    CREATE POLICY "documents admin insert any" ON public.documents FOR INSERT TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;
