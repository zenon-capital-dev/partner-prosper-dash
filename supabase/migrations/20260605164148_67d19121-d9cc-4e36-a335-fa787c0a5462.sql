
-- 1) Permitir client_id nulo (docs para colaborador/prestador sem cliente)
ALTER TABLE public.documents ALTER COLUMN client_id DROP NOT NULL;

-- 2) Trigger: exigir client_product_id apenas para docs de cliente
CREATE OR REPLACE FUNCTION public.enforce_demand_link_on_documents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_cp record;
BEGIN
  -- Só exige vínculo de demanda quando o documento é do cliente
  IF TG_OP = 'INSERT'
     AND NEW.client_id IS NOT NULL
     AND NEW.collaborator_id IS NULL
     AND NEW.provider_id IS NULL
     AND NEW.client_product_id IS NULL THEN
    RAISE EXCEPTION 'Documentos de cliente devem estar vinculados a uma demanda (client_product_id obrigatório).';
  END IF;

  IF NEW.client_product_id IS NOT NULL THEN
    SELECT client_id, product_id
    INTO v_cp
    FROM public.client_products
    WHERE id = NEW.client_product_id;

    NEW.client_id := COALESCE(NEW.client_id, v_cp.client_id);
    NEW.product_id := COALESCE(NEW.product_id, v_cp.product_id);
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) RLS — colaborador vê/atualiza documentos endereçados a ele
DROP POLICY IF EXISTS "Collaborators view assigned documents" ON public.documents;
CREATE POLICY "Collaborators view assigned documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (collaborator_id = auth.uid());

DROP POLICY IF EXISTS "Collaborators update assigned documents" ON public.documents;
CREATE POLICY "Collaborators update assigned documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (collaborator_id = auth.uid())
  WITH CHECK (collaborator_id = auth.uid());

-- 4) RLS — prestador vê/atualiza documentos endereçados a ele
DROP POLICY IF EXISTS "Providers view assigned documents" ON public.documents;
CREATE POLICY "Providers view assigned documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    provider_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.service_providers sp
      WHERE sp.id = documents.provider_id AND sp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Providers update assigned documents" ON public.documents;
CREATE POLICY "Providers update assigned documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (
    provider_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.service_providers sp
      WHERE sp.id = documents.provider_id AND sp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.service_providers sp
      WHERE sp.id = documents.provider_id AND sp.user_id = auth.uid()
    )
  );

-- 5) Notificar destinatário quando documento é solicitado
CREATE OR REPLACE FUNCTION public.notify_document_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_link text;
  v_title text;
BEGIN
  IF NEW.collaborator_id IS NOT NULL THEN
    v_user_id := NEW.collaborator_id;
    v_link := '/colaborador';
    v_title := 'Novo documento solicitado';
  ELSIF NEW.provider_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM public.service_providers WHERE id = NEW.provider_id;
    v_link := '/prestador';
    v_title := 'Novo documento solicitado';
  ELSIF NEW.client_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM public.clients WHERE id = NEW.client_id;
    v_link := '/cliente/documentos';
    v_title := 'Novo documento solicitado';
  END IF;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (
      v_user_id,
      v_title,
      COALESCE(NEW.name, 'Documento') ||
        CASE WHEN NEW.due_date IS NOT NULL THEN ' · prazo ' || to_char(NEW.due_date, 'DD/MM/YYYY') ELSE '' END,
      v_link,
      'document'
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_document_recipient ON public.documents;
CREATE TRIGGER trg_notify_document_recipient
  AFTER INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_document_recipient();
