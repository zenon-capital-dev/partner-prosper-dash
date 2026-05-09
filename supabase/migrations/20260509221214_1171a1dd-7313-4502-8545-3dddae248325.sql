
-- 1. Add client_product_id to legacy tables
ALTER TABLE public.client_document_requests ADD COLUMN IF NOT EXISTS client_product_id uuid;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS client_product_id uuid;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS client_product_id uuid;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS client_product_id uuid;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_cdr_client_product ON public.client_document_requests(client_product_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client_product ON public.contracts(client_product_id);
CREATE INDEX IF NOT EXISTS idx_notes_client_product ON public.notes(client_product_id);
CREATE INDEX IF NOT EXISTS idx_commissions_client_product ON public.commissions(client_product_id);

-- 3. Provider-delegated visibility on demand-bound rows
DROP POLICY IF EXISTS "Provider views delegated contracts (by demand)" ON public.contracts;
CREATE POLICY "Provider views delegated contracts (by demand)"
ON public.contracts FOR SELECT
USING (client_product_id IS NOT NULL AND public.is_delegated_provider(auth.uid(), client_product_id));

DROP POLICY IF EXISTS "Provider views delegated notes" ON public.notes;
CREATE POLICY "Provider views delegated notes"
ON public.notes FOR SELECT
USING (client_product_id IS NOT NULL AND public.is_delegated_provider(auth.uid(), client_product_id));

DROP POLICY IF EXISTS "Provider views delegated commissions context" ON public.commissions;
-- providers do NOT see commissions; this policy intentionally not added.

-- 4. Enforce demand link on NEW documents
CREATE OR REPLACE FUNCTION public.enforce_demand_link_on_documents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.client_product_id IS NULL THEN
    RAISE EXCEPTION 'Documentos devem estar vinculados a uma demanda (client_product_id obrigatório).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_demand_link_on_documents ON public.documents;
CREATE TRIGGER trg_enforce_demand_link_on_documents
BEFORE INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_demand_link_on_documents();

-- 5. Standardized demand activity logger
CREATE OR REPLACE FUNCTION public.log_demand_activity(
  _client_product_id uuid,
  _action text,
  _description text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
  VALUES (_action, 'client_product', _client_product_id, auth.uid(),
          jsonb_build_object('description', _description, 'metadata', _metadata))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
