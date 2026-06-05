
-- Junction table: multiple service providers per demand (client_product)
CREATE TABLE IF NOT EXISTS public.client_product_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_product_id uuid NOT NULL REFERENCES public.client_products(id) ON DELETE CASCADE,
  service_provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  role text,
  is_primary boolean NOT NULL DEFAULT false,
  added_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_product_id, service_provider_id)
);

CREATE INDEX IF NOT EXISTS idx_cpp_demand ON public.client_product_providers(client_product_id);
CREATE INDEX IF NOT EXISTS idx_cpp_provider ON public.client_product_providers(service_provider_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_product_providers TO authenticated;
GRANT ALL ON public.client_product_providers TO service_role;

ALTER TABLE public.client_product_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage demand providers"
  ON public.client_product_providers FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Providers view their demand assignments"
  ON public.client_product_providers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.service_providers sp
      WHERE sp.id = client_product_providers.service_provider_id
        AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Collaborators view providers of their demands"
  ON public.client_product_providers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_products cp
      WHERE cp.id = client_product_providers.client_product_id
        AND cp.responsible_employee_id = auth.uid()
    )
  );

CREATE TRIGGER trg_cpp_updated_at
  BEFORE UPDATE ON public.client_product_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Keep client_products.service_provider_id in sync with the primary entry (for backwards compat)
CREATE OR REPLACE FUNCTION public.sync_primary_provider_to_demand()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_primary THEN
    -- Garantir apenas um primary por demanda
    UPDATE public.client_product_providers
      SET is_primary = false, updated_at = now()
      WHERE client_product_id = NEW.client_product_id
        AND id <> NEW.id
        AND is_primary = true;

    UPDATE public.client_products
      SET service_provider_id = NEW.service_provider_id, updated_at = now()
      WHERE id = NEW.client_product_id;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.is_primary THEN
    UPDATE public.client_products
      SET service_provider_id = (
        SELECT service_provider_id FROM public.client_product_providers
        WHERE client_product_id = OLD.client_product_id
        ORDER BY created_at ASC LIMIT 1
      ),
      updated_at = now()
      WHERE id = OLD.client_product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_primary_provider
  AFTER INSERT OR UPDATE OR DELETE ON public.client_product_providers
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_provider_to_demand();

-- Backfill: replicate existing single provider into the junction table as primary
INSERT INTO public.client_product_providers (client_product_id, service_provider_id, is_primary)
SELECT id, service_provider_id, true
FROM public.client_products
WHERE service_provider_id IS NOT NULL
ON CONFLICT (client_product_id, service_provider_id) DO NOTHING;

-- Permitir prestadores secundários verem a demanda (RLS de client_products)
DROP POLICY IF EXISTS "Secondary providers view assigned demands" ON public.client_products;
CREATE POLICY "Secondary providers view assigned demands"
  ON public.client_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_product_providers cpp
      JOIN public.service_providers sp ON sp.id = cpp.service_provider_id
      WHERE cpp.client_product_id = client_products.id
        AND sp.user_id = auth.uid()
    )
  );

-- Documentos visíveis para prestadores secundários
DROP POLICY IF EXISTS "Secondary providers view demand documents" ON public.documents;
CREATE POLICY "Secondary providers view demand documents"
  ON public.documents FOR SELECT
  USING (
    client_product_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.client_product_providers cpp
      JOIN public.service_providers sp ON sp.id = cpp.service_provider_id
      WHERE cpp.client_product_id = documents.client_product_id
        AND sp.user_id = auth.uid()
    )
  );
