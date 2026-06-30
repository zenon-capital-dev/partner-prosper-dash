
-- ============================================================
-- Auto-log demand activity into activity_logs
-- entity_type = 'client_product', entity_id = client_product_id
-- ============================================================

-- Status changes on client_products
CREATE OR REPLACE FUNCTION public.log_demand_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
    VALUES ('DEMAND_CREATED', 'client_product', NEW.id, auth.uid(),
            jsonb_build_object('description', 'Demanda criada · status: ' || COALESCE(NEW.status, '—')));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, old_data, new_data)
      VALUES ('STATUS_CHANGED', 'client_product', NEW.id, auth.uid(),
              jsonb_build_object('status', OLD.status),
              jsonb_build_object('description', 'Status: ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'), 'status', NEW.status));
    END IF;
    IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
      INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
      VALUES ('DEADLINE_CHANGED', 'client_product', NEW.id, auth.uid(),
              jsonb_build_object('description', 'Prazo alterado para ' || COALESCE(NEW.deadline::text, 'sem prazo')));
    END IF;
    IF NEW.service_provider_id IS DISTINCT FROM OLD.service_provider_id THEN
      INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
      VALUES ('PROVIDER_CHANGED', 'client_product', NEW.id, auth.uid(),
              jsonb_build_object('description', 'Prestador atribuído/alterado'));
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'log_demand_status_change error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demand_status ON public.client_products;
CREATE TRIGGER trg_log_demand_status
AFTER INSERT OR UPDATE ON public.client_products
FOR EACH ROW EXECUTE FUNCTION public.log_demand_status_change();

-- New status report
CREATE OR REPLACE FUNCTION public.log_demand_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
  VALUES ('REPORT_SUBMITTED', 'client_product', NEW.client_product_id, COALESCE(NEW.reported_by, auth.uid()),
          jsonb_build_object(
            'description', 'Reporte enviado · status: ' || COALESCE(NEW.status, '—'),
            'status', NEW.status,
            'notes', NEW.notes,
            'pending', NEW.pending,
            'next_steps', NEW.next_steps
          ));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'log_demand_report error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demand_report ON public.client_product_status_reports;
CREATE TRIGGER trg_log_demand_report
AFTER INSERT ON public.client_product_status_reports
FOR EACH ROW EXECUTE FUNCTION public.log_demand_report();

-- New comment
CREATE OR REPLACE FUNCTION public.log_demand_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
  VALUES ('COMMENT_ADDED', 'client_product', NEW.client_product_id, COALESCE(NEW.author_id, auth.uid()),
          jsonb_build_object(
            'description', 'Comentário (' || COALESCE(NEW.author_role, 'usuário') || '): ' || left(COALESCE(NEW.content,''), 140),
            'role', NEW.author_role
          ));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'log_demand_comment error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demand_comment ON public.demand_comments;
CREATE TRIGGER trg_log_demand_comment
AFTER INSERT ON public.demand_comments
FOR EACH ROW EXECUTE FUNCTION public.log_demand_comment();

-- New request
CREATE OR REPLACE FUNCTION public.log_demand_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
  VALUES ('REQUEST_CREATED', 'client_product', NEW.client_product_id, COALESCE(NEW.requested_by, auth.uid()),
          jsonb_build_object(
            'description', 'Solicitação aberta · ' || COALESCE(NEW.title, '—') || ' (→ ' || COALESCE(NEW.target_role, '?') || ')',
            'kind', NEW.kind,
            'target_role', NEW.target_role
          ));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'log_demand_request error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demand_request ON public.demand_requests;
CREATE TRIGGER trg_log_demand_request
AFTER INSERT ON public.demand_requests
FOR EACH ROW EXECUTE FUNCTION public.log_demand_request();

-- New delivery
CREATE OR REPLACE FUNCTION public.log_demand_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
  VALUES ('DELIVERY_RECORDED', 'client_product', NEW.client_product_id, auth.uid(),
          jsonb_build_object('description', 'Entrega registrada: ' || COALESCE(NEW.title, '—')));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'log_demand_delivery error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demand_delivery ON public.demand_deliveries;
CREATE TRIGGER trg_log_demand_delivery
AFTER INSERT ON public.demand_deliveries
FOR EACH ROW EXECUTE FUNCTION public.log_demand_delivery();

-- Document status changes on docs linked to a demand
CREATE OR REPLACE FUNCTION public.log_demand_document_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_product_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
    VALUES ('DOCUMENT_REQUESTED', 'client_product', NEW.client_product_id, auth.uid(),
            jsonb_build_object('description', 'Documento solicitado: ' || COALESCE(NEW.name, '—')));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
    VALUES ('DOCUMENT_STATUS', 'client_product', NEW.client_product_id, auth.uid(),
            jsonb_build_object('description', 'Documento "' || COALESCE(NEW.name, '—') || '": ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—')));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'log_demand_document_event error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demand_document ON public.documents;
CREATE TRIGGER trg_log_demand_document
AFTER INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.log_demand_document_event();

-- Lock down EXECUTE on these trigger functions
REVOKE EXECUTE ON FUNCTION public.log_demand_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_demand_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_demand_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_demand_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_demand_delivery() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_demand_document_event() FROM PUBLIC, anon, authenticated;
