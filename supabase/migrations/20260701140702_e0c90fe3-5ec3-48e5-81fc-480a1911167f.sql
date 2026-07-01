
-- Update comment trigger: deep-link client to /demandas/:id?tab=comments
CREATE OR REPLACE FUNCTION public.notify_demand_comment_all()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cp record;
  v_client_user uuid;
  v_provider_user uuid;
  v_link text;
  v_author uuid := NEW.user_id;
BEGIN
  SELECT cp.id, cp.client_id, cp.service_provider_id, cp.custom_product_name
    INTO v_cp
  FROM public.client_products cp WHERE cp.id = NEW.client_product_id;

  IF v_cp.id IS NULL THEN RETURN NEW; END IF;
  v_link := '/demandas/' || v_cp.id || '?tab=comments';

  SELECT user_id INTO v_client_user FROM public.clients WHERE id = v_cp.client_id;
  SELECT user_id INTO v_provider_user FROM public.service_providers WHERE id = v_cp.service_provider_id;

  IF v_client_user IS NOT NULL AND v_client_user <> v_author AND public.notification_enabled(v_client_user, 'comment') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_client_user, 'Novo comentário na sua demanda', COALESCE(v_cp.custom_product_name, '—'), v_link, 'comment');
  END IF;

  IF v_provider_user IS NOT NULL AND v_provider_user <> v_author AND public.notification_enabled(v_provider_user, 'comment') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_provider_user, 'Novo comentário em demanda', COALESCE(v_cp.custom_product_name, '—'), v_link, 'comment');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id, 'Novo comentário em demanda', COALESCE(v_cp.custom_product_name, '—'), v_link, 'comment'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','admin_secondary','super_admin')
    AND ur.user_id <> v_author
    AND public.notification_enabled(ur.user_id, 'comment');

  RETURN NEW;
END;
$function$;

-- Update status trigger: deep-link client to /demandas/:id
CREATE OR REPLACE FUNCTION public.notify_demand_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client_user uuid; v_provider_user uuid; v_link text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_link := '/demandas/' || NEW.id;

  SELECT user_id INTO v_client_user FROM public.clients WHERE id = NEW.client_id;
  SELECT user_id INTO v_provider_user FROM public.service_providers WHERE id = NEW.service_provider_id;

  IF v_client_user IS NOT NULL AND public.notification_enabled(v_client_user, 'status') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_client_user, 'Status da demanda atualizado',
      COALESCE(NEW.custom_product_name, '—') || ': ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'),
      v_link, 'status');
  END IF;

  IF v_provider_user IS NOT NULL AND public.notification_enabled(v_provider_user, 'status') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_provider_user, 'Status da demanda atualizado',
      COALESCE(NEW.custom_product_name, '—') || ': ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'),
      v_link, 'status');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id, 'Status de demanda atualizado',
         COALESCE(NEW.custom_product_name,'—') || ': ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'),
         v_link, 'status'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','admin_secondary','super_admin')
    AND public.notification_enabled(ur.user_id, 'status');

  RETURN NEW;
END;
$function$;

-- New: demand_request_messages chat notifications
CREATE OR REPLACE FUNCTION public.notify_demand_request_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_req record;
  v_client_user uuid;
  v_provider_user uuid;
  v_link text;
BEGIN
  SELECT dr.id, dr.client_product_id, dr.client_id, dr.title, dr.requested_by
    INTO v_req
  FROM public.demand_requests dr WHERE dr.id = NEW.request_id;
  IF v_req.id IS NULL THEN RETURN NEW; END IF;

  v_link := '/demandas/' || v_req.client_product_id || '?tab=comments';

  SELECT user_id INTO v_client_user FROM public.clients WHERE id = v_req.client_id;
  SELECT sp.user_id INTO v_provider_user
    FROM public.client_products cp
    LEFT JOIN public.service_providers sp ON sp.id = cp.service_provider_id
    WHERE cp.id = v_req.client_product_id;

  IF v_client_user IS NOT NULL AND v_client_user <> NEW.author_id AND public.notification_enabled(v_client_user, 'comment') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_client_user, 'Nova mensagem em solicitação', COALESCE(v_req.title,'—'), v_link, 'comment');
  END IF;

  IF v_provider_user IS NOT NULL AND v_provider_user <> NEW.author_id AND public.notification_enabled(v_provider_user, 'comment') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_provider_user, 'Nova mensagem em solicitação', COALESCE(v_req.title,'—'), v_link, 'comment');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id, 'Nova mensagem em solicitação', COALESCE(v_req.title,'—'), v_link, 'comment'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','admin_secondary','super_admin')
    AND ur.user_id <> NEW.author_id
    AND public.notification_enabled(ur.user_id, 'comment');

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_demand_request_message ON public.demand_request_messages;
CREATE TRIGGER trg_notify_demand_request_message
AFTER INSERT ON public.demand_request_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_demand_request_message();

-- New: client_support_ticket_messages chat notifications
CREATE OR REPLACE FUNCTION public.notify_client_support_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_t record;
  v_client_user uuid;
  v_link text;
BEGIN
  SELECT t.id, t.client_id, t.subject, t.assigned_to, t.created_by
    INTO v_t
  FROM public.client_support_tickets t WHERE t.id = NEW.ticket_id;
  IF v_t.id IS NULL THEN RETURN NEW; END IF;

  v_link := '/portal-cliente/suporte';

  SELECT user_id INTO v_client_user FROM public.clients WHERE id = v_t.client_id;

  IF v_client_user IS NOT NULL AND v_client_user <> NEW.sender_id AND public.notification_enabled(v_client_user, 'comment') THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (v_client_user, 'Nova mensagem no seu suporte', COALESCE(v_t.subject,'—'), v_link, 'comment');
  END IF;

  -- Admins go to /suporte
  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id, 'Nova mensagem em ticket de cliente', COALESCE(v_t.subject,'—'), '/suporte', 'comment'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','admin_secondary','super_admin')
    AND ur.user_id <> NEW.sender_id
    AND public.notification_enabled(ur.user_id, 'comment');

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_client_support_message ON public.client_support_ticket_messages;
CREATE TRIGGER trg_notify_client_support_message
AFTER INSERT ON public.client_support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_client_support_message();
