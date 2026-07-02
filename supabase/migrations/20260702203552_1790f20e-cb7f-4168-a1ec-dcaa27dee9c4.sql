CREATE OR REPLACE FUNCTION public.notify_demand_comment_all()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cp record;
  v_client_user uuid;
  v_provider_user uuid;
  v_link text;
  v_author uuid := COALESCE(NEW.author_id, auth.uid());
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