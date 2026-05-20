
-- ============================================================
-- 1. Drop product_categories e coluna category_id em products
-- ============================================================
ALTER TABLE public.products DROP COLUMN IF EXISTS category_id;
DROP TABLE IF EXISTS public.product_categories CASCADE;

-- ============================================================
-- 2. Novas colunas em products (parcelamento + contrato vinculado)
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS default_contract_template_id uuid,
  ADD COLUMN IF NOT EXISTS installments_count integer,
  ADD COLUMN IF NOT EXISTS installments_entry numeric(12,2),
  ADD COLUMN IF NOT EXISTS installments_due_day integer;

-- ============================================================
-- 3. Tabela contract_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  file_path text,
  content text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contract templates"
ON public.contract_templates FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read active templates"
ON public.contract_templates FOR SELECT
USING (auth.uid() IS NOT NULL AND active = true);

CREATE TRIGGER trg_contract_templates_updated
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK em products
ALTER TABLE public.products
  ADD CONSTRAINT products_default_contract_template_fk
  FOREIGN KEY (default_contract_template_id)
  REFERENCES public.contract_templates(id) ON DELETE SET NULL;

-- ============================================================
-- 4. service_provider_products (prestador <-> produto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_provider_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_value numeric(12,2),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (service_provider_id, product_id)
);

ALTER TABLE public.service_provider_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage provider products"
ON public.service_provider_products FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Providers view own product links"
ON public.service_provider_products FOR SELECT
USING (public.is_provider_owner(auth.uid(), service_provider_id));

CREATE TRIGGER trg_service_provider_products_updated
BEFORE UPDATE ON public.service_provider_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. collaborator_products (colaborador <-> produto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.collaborator_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (collaborator_id, product_id)
);

ALTER TABLE public.collaborator_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage collaborator products"
ON public.collaborator_products FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Collaborators view own product links"
ON public.collaborator_products FOR SELECT
USING (collaborator_id = auth.uid());

CREATE TRIGGER trg_collaborator_products_updated
BEFORE UPDATE ON public.collaborator_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
