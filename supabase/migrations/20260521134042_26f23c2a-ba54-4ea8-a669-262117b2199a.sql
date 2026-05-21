-- 1) Keep duplicated client relationship columns synchronized.
CREATE OR REPLACE FUNCTION public.normalize_client_alias_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.collaborator_id := COALESCE(NEW.collaborator_id, NEW.responsible_id);
    NEW.responsible_id := COALESCE(NEW.responsible_id, NEW.collaborator_id);

    NEW.referrer_id := COALESCE(NEW.referrer_id, NEW.indicator_id);
    NEW.indicator_id := COALESCE(NEW.indicator_id, NEW.referrer_id);

    NEW.service_provider_id := COALESCE(NEW.service_provider_id, NEW.provider_id);
    NEW.provider_id := COALESCE(NEW.provider_id, NEW.service_provider_id);
  ELSE
    IF NEW.responsible_id IS DISTINCT FROM OLD.responsible_id
       AND NEW.collaborator_id IS NOT DISTINCT FROM OLD.collaborator_id THEN
      NEW.collaborator_id := NEW.responsible_id;
    ELSIF NEW.collaborator_id IS DISTINCT FROM OLD.collaborator_id
       AND NEW.responsible_id IS NOT DISTINCT FROM OLD.responsible_id THEN
      NEW.responsible_id := NEW.collaborator_id;
    ELSE
      NEW.collaborator_id := COALESCE(NEW.collaborator_id, NEW.responsible_id);
      NEW.responsible_id := COALESCE(NEW.responsible_id, NEW.collaborator_id);
    END IF;

    IF NEW.indicator_id IS DISTINCT FROM OLD.indicator_id
       AND NEW.referrer_id IS NOT DISTINCT FROM OLD.referrer_id THEN
      NEW.referrer_id := NEW.indicator_id;
    ELSIF NEW.referrer_id IS DISTINCT FROM OLD.referrer_id
       AND NEW.indicator_id IS NOT DISTINCT FROM OLD.indicator_id THEN
      NEW.indicator_id := NEW.referrer_id;
    ELSE
      NEW.referrer_id := COALESCE(NEW.referrer_id, NEW.indicator_id);
      NEW.indicator_id := COALESCE(NEW.indicator_id, NEW.referrer_id);
    END IF;

    IF NEW.provider_id IS DISTINCT FROM OLD.provider_id
       AND NEW.service_provider_id IS NOT DISTINCT FROM OLD.service_provider_id THEN
      NEW.service_provider_id := NEW.provider_id;
    ELSIF NEW.service_provider_id IS DISTINCT FROM OLD.service_provider_id
       AND NEW.provider_id IS NOT DISTINCT FROM OLD.provider_id THEN
      NEW.provider_id := NEW.service_provider_id;
    ELSE
      NEW.service_provider_id := COALESCE(NEW.service_provider_id, NEW.provider_id);
      NEW.provider_id := COALESCE(NEW.provider_id, NEW.service_provider_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_client_alias_fields ON public.clients;
CREATE TRIGGER trg_normalize_client_alias_fields
BEFORE INSERT OR UPDATE OF collaborator_id, responsible_id, referrer_id, indicator_id, service_provider_id, provider_id
ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.normalize_client_alias_fields();

-- 2) Fill sale network from the linked client when a sale is created with blanks.
CREATE OR REPLACE FUNCTION public.fill_sale_links_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client record;
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT partner_id, referrer_id, indicator_id, collaborator_id, responsible_id
  INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  NEW.partner_id := COALESCE(NEW.partner_id, v_client.partner_id);
  NEW.referrer_id := COALESCE(NEW.referrer_id, v_client.referrer_id, v_client.indicator_id);
  NEW.collaborator_id := COALESCE(NEW.collaborator_id, v_client.collaborator_id, v_client.responsible_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_sale_links_from_client ON public.sales;
CREATE TRIGGER trg_fill_sale_links_from_client
BEFORE INSERT OR UPDATE OF client_id, partner_id, referrer_id, collaborator_id
ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.fill_sale_links_from_client();

-- 3) Ensure client_products created from sales carry operational links and sale_id.
CREATE OR REPLACE FUNCTION public.sync_sale_to_client_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_target_status text;
  v_client record;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT collaborator_id, responsible_id, service_provider_id, provider_id
  INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  v_target_status := CASE
    WHEN NEW.status::text = 'cancelada' THEN 'cancelado'
    WHEN NEW.status::text = 'concluida' THEN 'em_andamento'
    ELSE NEW.status::text
  END;

  SELECT id INTO v_existing_id
  FROM public.client_products
  WHERE sale_id = NEW.id
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    SELECT cp.id INTO v_existing_id
    FROM public.client_products cp
    WHERE cp.client_id = NEW.client_id
      AND cp.product_id = NEW.product_id
      AND cp.sale_id IS NULL
      AND cp.created_at >= now() - interval '15 minutes'
    ORDER BY cp.created_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.client_products
    SET sale_id = COALESCE(sale_id, NEW.id),
        status = CASE WHEN TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN v_target_status ELSE status END,
        value = COALESCE(value, NEW.amount),
        responsible_employee_id = COALESCE(responsible_employee_id, NEW.collaborator_id, v_client.collaborator_id, v_client.responsible_id),
        service_provider_id = COALESCE(service_provider_id, v_client.service_provider_id, v_client.provider_id),
        updated_at = now()
    WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  IF NEW.status::text = 'cancelada' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.client_products (
    client_id, product_id, sale_id, status, value, start_date,
    responsible_employee_id, service_provider_id
  )
  VALUES (
    NEW.client_id, NEW.product_id, NEW.id, v_target_status,
    NEW.amount, COALESCE(NEW.sale_date, CURRENT_DATE),
    COALESCE(NEW.collaborator_id, v_client.collaborator_id, v_client.responsible_id),
    COALESCE(v_client.service_provider_id, v_client.provider_id)
  );

  RETURN NEW;
END;
$$;

-- 4) Fill demand links from the client using both canonical and legacy aliases.
CREATE OR REPLACE FUNCTION public.fill_client_product_responsible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.responsible_employee_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT COALESCE(collaborator_id, responsible_id)
    INTO NEW.responsible_employee_id
    FROM public.clients
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fill_client_product_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_provider_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT COALESCE(service_provider_id, provider_id)
    INTO NEW.service_provider_id
    FROM public.clients
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_client_collaborator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old uuid := COALESCE(OLD.collaborator_id, OLD.responsible_id);
  v_new uuid := COALESCE(NEW.collaborator_id, NEW.responsible_id);
BEGIN
  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE public.client_products
    SET responsible_employee_id = v_new,
        updated_at = now()
    WHERE client_id = NEW.id
      AND COALESCE(status,'') NOT IN ('concluido', 'concluida', 'cancelado', 'cancelada')
      AND (responsible_employee_id IS NULL OR responsible_employee_id IS NOT DISTINCT FROM v_old);

    UPDATE public.tasks t
    SET assigned_to = v_new,
        updated_at = now()
    FROM public.client_products cp
    WHERE t.client_product_id = cp.id
      AND cp.client_id = NEW.id
      AND COALESCE(t.status_new::text, t.status, '') NOT IN ('concluida','concluido','cancelada','cancelado','done')
      AND (t.assigned_to IS NULL OR t.assigned_to IS NOT DISTINCT FROM v_old);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_client_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old uuid := COALESCE(OLD.service_provider_id, OLD.provider_id);
  v_new uuid := COALESCE(NEW.service_provider_id, NEW.provider_id);
BEGIN
  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE public.client_products
    SET service_provider_id = v_new,
        updated_at = now()
    WHERE client_id = NEW.id
      AND COALESCE(status,'') NOT IN ('concluido', 'concluida', 'cancelado', 'cancelada')
      AND (service_provider_id IS NULL OR service_provider_id IS NOT DISTINCT FROM v_old);
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Fill task client/assignee from demand consistently.
CREATE OR REPLACE FUNCTION public.fill_task_assigned_from_demand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cp record;
BEGIN
  IF NEW.client_product_id IS NOT NULL THEN
    SELECT client_id, responsible_employee_id
    INTO v_cp
    FROM public.client_products
    WHERE id = NEW.client_product_id;

    NEW.client_id := COALESCE(NEW.client_id, v_cp.client_id);
    NEW.assigned_to := COALESCE(NEW.assigned_to, v_cp.responsible_employee_id);
  END IF;

  IF NEW.assigned_to IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT COALESCE(collaborator_id, responsible_id)
    INTO NEW.assigned_to
    FROM public.clients
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 6) Fill document client/product from demand, while still requiring a demand.
CREATE OR REPLACE FUNCTION public.enforce_demand_link_on_documents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_cp record;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.client_product_id IS NULL THEN
    RAISE EXCEPTION 'Documentos devem estar vinculados a uma demanda (client_product_id obrigatório).';
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
$$;

DROP TRIGGER IF EXISTS trg_enforce_demand_link_on_documents ON public.documents;
CREATE TRIGGER trg_enforce_demand_link_on_documents
BEFORE INSERT OR UPDATE OF client_product_id, client_id, product_id
ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_demand_link_on_documents();

-- 7) Mirror provider/client document requests into the documents table used by admin/client/collaborator panels.
CREATE OR REPLACE FUNCTION public.sync_client_document_request_to_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_doc_id uuid;
  v_product_id uuid;
  v_name text;
  v_status public.document_status_new;
BEGIN
  IF NEW.client_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT product_id INTO v_product_id
  FROM public.client_products
  WHERE id = NEW.client_product_id;

  v_name := COALESCE(NEW.title, 'Documento solicitado');
  v_status := CASE
    WHEN NEW.status IN ('enviado','submitted') THEN 'enviado'::public.document_status_new
    WHEN NEW.status IN ('aprovado','approved') THEN 'aprovado'::public.document_status_new
    WHEN NEW.status IN ('reprovado','rejeitado','rejected') THEN 'reprovado'::public.document_status_new
    WHEN NEW.status IN ('em_analise','in_review') THEN 'em_analise'::public.document_status_new
    ELSE 'solicitado'::public.document_status_new
  END;

  SELECT id INTO v_doc_id
  FROM public.documents
  WHERE (internal_notes LIKE ('client_document_request:' || NEW.id::text || '%'))
     OR (client_id = NEW.client_id AND client_product_id = NEW.client_product_id AND name = v_name AND requested_at = NEW.created_at)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_doc_id IS NULL THEN
    INSERT INTO public.documents (
      client_id, client_product_id, product_id, name, description, status,
      file_path, due_date, requested_at, uploaded_at, is_required, is_public, internal_notes
    )
    VALUES (
      NEW.client_id, NEW.client_product_id, v_product_id, v_name, NEW.description, v_status,
      NEW.file_url, NEW.due_date, NEW.created_at,
      CASE WHEN NEW.file_url IS NOT NULL THEN COALESCE(NEW.updated_at, now()) ELSE NULL END,
      true, true, 'client_document_request:' || NEW.id::text
    );
  ELSE
    UPDATE public.documents
    SET name = v_name,
        description = NEW.description,
        status = v_status,
        file_path = NEW.file_url,
        due_date = NEW.due_date,
        product_id = COALESCE(product_id, v_product_id),
        uploaded_at = CASE WHEN NEW.file_url IS NOT NULL THEN COALESCE(NEW.updated_at, now()) ELSE uploaded_at END,
        updated_at = now()
    WHERE id = v_doc_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_document_request_to_document ON public.client_document_requests;
CREATE TRIGGER trg_sync_client_document_request_to_document
AFTER INSERT OR UPDATE OF title, description, status, file_url, due_date, client_product_id, client_id
ON public.client_document_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_document_request_to_document();

-- 8) Make template population complete and compatible with current task/document flows.
CREATE OR REPLACE FUNCTION public.populate_client_product_from_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p_record RECORD;
  step_item JSONB;
  doc_item JSONB;
  task_item JSONB;
  v_pos INTEGER := 0;
  v_doc_name TEXT;
BEGIN
  SELECT * INTO p_record FROM public.products WHERE id = NEW.product_id;
  IF p_record.id IS NOT NULL THEN
    IF p_record.standard_steps IS NOT NULL AND jsonb_typeof(p_record.standard_steps) = 'array' AND jsonb_array_length(p_record.standard_steps) > 0 THEN
      FOR step_item IN SELECT jsonb_array_elements(p_record.standard_steps) LOOP
        INSERT INTO public.client_product_steps (client_product_id, label, description, position, status)
        VALUES (
          NEW.id,
          COALESCE(step_item->>'label', step_item->>'name', 'Etapa'),
          step_item->>'description',
          v_pos,
          'pendente'::public.step_status
        )
        ON CONFLICT DO NOTHING;
        v_pos := v_pos + 1;
      END LOOP;
    END IF;

    IF p_record.required_documents IS NOT NULL AND jsonb_typeof(p_record.required_documents) = 'array' AND jsonb_array_length(p_record.required_documents) > 0 THEN
      FOR doc_item IN SELECT jsonb_array_elements(p_record.required_documents) LOOP
        v_doc_name := COALESCE(doc_item->>'name', doc_item->>'label', doc_item#>>'{}');
        IF NULLIF(v_doc_name, '') IS NOT NULL THEN
          INSERT INTO public.documents (client_id, client_product_id, product_id, name, description, status, is_required, is_public, requested_at)
          VALUES (NEW.client_id, NEW.id, NEW.product_id, v_doc_name, doc_item->>'description', 'solicitado'::public.document_status_new, true, true, now())
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END IF;

    IF p_record.auto_tasks_template IS NOT NULL AND jsonb_typeof(p_record.auto_tasks_template) = 'array' AND jsonb_array_length(p_record.auto_tasks_template) > 0 THEN
      FOR task_item IN SELECT jsonb_array_elements(p_record.auto_tasks_template) LOOP
        INSERT INTO public.tasks (
          title, description, status, status_new, priority,
          client_id, client_product_id, assigned_to, related_entity_type, related_entity_id, created_by
        )
        VALUES (
          COALESCE(task_item->>'title', 'Tarefa da demanda'),
          task_item->>'description',
          'a_fazer',
          'a_fazer'::public.task_status_new,
          COALESCE(task_item->>'priority', 'normal'),
          NEW.client_id,
          NEW.id,
          NEW.responsible_employee_id,
          'client_product',
          NEW.id,
          auth.uid()
        );
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 9) Fill payment links from the sale so dashboards and commissions stay aligned.
CREATE OR REPLACE FUNCTION public.fill_payment_links_from_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sale record;
BEGIN
  IF NEW.sale_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT client_id, partner_id, referrer_id, collaborator_id
  INTO v_sale
  FROM public.sales
  WHERE id = NEW.sale_id;

  NEW.client_id := COALESCE(NEW.client_id, v_sale.client_id);
  NEW.partner_id := COALESCE(NEW.partner_id, v_sale.partner_id);
  NEW.referrer_id := COALESCE(NEW.referrer_id, v_sale.referrer_id);
  NEW.collaborator_id := COALESCE(NEW.collaborator_id, v_sale.collaborator_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_payment_links_from_sale ON public.payments;
CREATE TRIGGER trg_fill_payment_links_from_sale
BEFORE INSERT OR UPDATE OF sale_id, client_id, partner_id, referrer_id, collaborator_id
ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.fill_payment_links_from_sale();

-- 10) Restrict direct execution of sensitive security-definer functions.
REVOKE EXECUTE ON FUNCTION public.admin_delete_client_cascade(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.normalize_client_alias_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_sale_links_from_client() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_client_document_request_to_document() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_payment_links_from_sale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_sale_to_client_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_client_product_responsible() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_client_product_provider() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.propagate_client_collaborator() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.propagate_client_provider() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_task_assigned_from_demand() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_demand_link_on_documents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.populate_client_product_from_template() FROM PUBLIC, anon, authenticated;