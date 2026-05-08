
-- 1. Add client_product_id to documents and document_requests
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS client_product_id UUID REFERENCES public.client_products(id) ON DELETE SET NULL;
ALTER TABLE public.document_requests ADD COLUMN IF NOT EXISTS client_product_id UUID REFERENCES public.client_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_client_product ON public.documents(client_product_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_client_product ON public.document_requests(client_product_id);

-- 2. Contract kind
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_kind TEXT NOT NULL DEFAULT 'cliente';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

-- 3. Status reports table
CREATE TABLE IF NOT EXISTS public.client_product_status_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_product_id UUID NOT NULL REFERENCES public.client_products(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpsr_client_product ON public.client_product_status_reports(client_product_id);
CREATE INDEX IF NOT EXISTS idx_cpsr_created_at ON public.client_product_status_reports(created_at DESC);

ALTER TABLE public.client_product_status_reports ENABLE ROW LEVEL SECURITY;

-- 4. Helper function: is provider delegated to a client_product?
CREATE OR REPLACE FUNCTION public.is_delegated_provider(_user_id UUID, _client_product_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_products cp
    LEFT JOIN public.partners p ON p.id = cp.service_provider_id
    LEFT JOIN public.employees e ON e.id = cp.service_provider_id
    WHERE cp.id = _client_product_id
      AND (
        p.user_id = _user_id
        OR e.user_id = _user_id
      )
  );
$$;

-- 5. RLS for status reports
DROP POLICY IF EXISTS "Admins manage status reports" ON public.client_product_status_reports;
CREATE POLICY "Admins manage status reports"
  ON public.client_product_status_reports
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Provider creates own reports" ON public.client_product_status_reports;
CREATE POLICY "Provider creates own reports"
  ON public.client_product_status_reports
  FOR INSERT
  WITH CHECK (
    public.is_delegated_provider(auth.uid(), client_product_id)
    AND reported_by = auth.uid()
  );

DROP POLICY IF EXISTS "Provider views own reports" ON public.client_product_status_reports;
CREATE POLICY "Provider views own reports"
  ON public.client_product_status_reports
  FOR SELECT
  USING (
    public.is_delegated_provider(auth.uid(), client_product_id)
  );

DROP POLICY IF EXISTS "Client views own product reports" ON public.client_product_status_reports;
CREATE POLICY "Client views own product reports"
  ON public.client_product_status_reports
  FOR SELECT
  USING (
    client_product_id IN (
      SELECT cp.id FROM public.client_products cp
      JOIN public.clients c ON c.id = cp.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- 6. RLS for client_products: provider sees delegated rows
DROP POLICY IF EXISTS "Provider views delegated products" ON public.client_products;
CREATE POLICY "Provider views delegated products"
  ON public.client_products
  FOR SELECT
  USING (public.is_delegated_provider(auth.uid(), id));

DROP POLICY IF EXISTS "Provider updates delegated products" ON public.client_products;
CREATE POLICY "Provider updates delegated products"
  ON public.client_products
  FOR UPDATE
  USING (public.is_delegated_provider(auth.uid(), id));

-- 7. RLS for documents: provider sees only documents linked to delegated client_products
DROP POLICY IF EXISTS "Provider views delegated documents" ON public.documents;
CREATE POLICY "Provider views delegated documents"
  ON public.documents
  FOR SELECT
  USING (
    client_product_id IS NOT NULL
    AND public.is_delegated_provider(auth.uid(), client_product_id)
  );

-- 8. RLS for document_requests: same scoping
DROP POLICY IF EXISTS "Provider views delegated requests" ON public.document_requests;
CREATE POLICY "Provider views delegated requests"
  ON public.document_requests
  FOR SELECT
  USING (
    client_product_id IS NOT NULL
    AND public.is_delegated_provider(auth.uid(), client_product_id)
  );

DROP POLICY IF EXISTS "Provider updates delegated requests" ON public.document_requests;
CREATE POLICY "Provider updates delegated requests"
  ON public.document_requests
  FOR UPDATE
  USING (
    client_product_id IS NOT NULL
    AND public.is_delegated_provider(auth.uid(), client_product_id)
  );

-- 9. Trigger: on status report -> notify admins + update client_products.status
CREATE OR REPLACE FUNCTION public.on_status_report_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
  v_product_name TEXT;
BEGIN
  -- Update client_products status
  UPDATE public.client_products SET status = NEW.status, updated_at = now() WHERE id = NEW.client_product_id;

  -- Fetch info for notification
  SELECT c.full_name, COALESCE(p.name, cp.custom_product_name, '—')
  INTO v_client_name, v_product_name
  FROM public.client_products cp
  JOIN public.clients c ON c.id = cp.client_id
  LEFT JOIN public.products p ON p.id = cp.product_id
  WHERE cp.id = NEW.client_product_id;

  PERFORM public.notify_admins(
    'Status reportado pelo prestador',
    COALESCE(v_client_name,'Cliente') || ' · ' || COALESCE(v_product_name,'Produto') || ' → ' || NEW.status,
    '/projetos',
    'status_report'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_status_report_inserted ON public.client_product_status_reports;
CREATE TRIGGER trg_on_status_report_inserted
AFTER INSERT ON public.client_product_status_reports
FOR EACH ROW EXECUTE FUNCTION public.on_status_report_inserted();
