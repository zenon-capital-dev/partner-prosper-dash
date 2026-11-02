-- Permite que documentos de cliente enviados para uma pasta (folder_id)
-- sejam gravados sem client_product_id, desde que a pasta pertença ao
-- mesmo cliente do documento. Demais regras permanecem iguais à versão
-- definida em 20260605164148_67d19121-d9cc-4e36-a335-fa787c0a5462.sql.
CREATE OR REPLACE FUNCTION public.enforce_demand_link_on_documents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_cp record;
BEGIN
  -- Só exige vínculo de demanda quando o documento é do cliente
  -- e não está em uma pasta do próprio cliente
  IF TG_OP = 'INSERT'
     AND NEW.client_id IS NOT NULL
     AND NEW.collaborator_id IS NULL
     AND NEW.provider_id IS NULL
     AND NEW.client_product_id IS NULL
     AND NOT (NEW.folder_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.client_document_folders f WHERE f.id = NEW.folder_id AND f.client_id = NEW.client_id)) THEN
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
