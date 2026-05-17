
-- 1) Fix notification routes
CREATE OR REPLACE FUNCTION public.on_contract_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_user_id UUID;
  v_partner_user_id UUID;
  v_client_name TEXT;
  v_action_user_id UUID;
BEGIN
  v_action_user_id := auth.uid();

  SELECT user_id, full_name INTO v_client_user_id, v_client_name FROM public.clients WHERE id = NEW.client_id;

  SELECT p.user_id INTO v_partner_user_id
  FROM public.partners p
  JOIN public.clients c ON c.partner_id = p.id
  WHERE c.id = NEW.client_id;

  IF NEW.status != OLD.status AND v_client_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (
      v_client_user_id,
      CASE
        WHEN NEW.status::text = 'enviado' THEN 'Contrato para Assinatura'
        WHEN NEW.status::text = 'assinado' THEN 'Contrato Confirmado'
        WHEN NEW.status::text = 'pendente_correcao' THEN 'Ajuste no Contrato'
        ELSE 'Atualização de Contrato'
      END,
      CASE
        WHEN NEW.status::text = 'enviado' THEN 'O contrato "' || NEW.name || '" foi enviado para sua assinatura.'
        WHEN NEW.status::text = 'assinado' THEN 'Você assinou o contrato "' || NEW.name || '" com sucesso.'
        WHEN NEW.status::text = 'pendente_correcao' THEN 'Uma correção foi solicitada para o contrato "' || NEW.name || '".'
        ELSE 'O status do seu contrato "' || NEW.name || '" mudou para ' || (NEW.status)::text
      END,
      '/cliente/contratos',
      'contract'
    );
  END IF;

  IF NEW.status::text = 'assinado' AND OLD.status::text != 'assinado' AND v_partner_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (
      v_partner_user_id,
      'Seu Cliente Assinou!',
      'O cliente ' || v_client_name || ' assinou o contrato "' || NEW.name || '".',
      '/parceiro',
      'contract'
    );
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (v_action_user_id, 'CONTRACT_UPDATE', 'contracts', NEW.id, to_jsonb(OLD), to_jsonb(NEW));

  INSERT INTO public.contract_history (contract_id, status, file_path, action_by, notes)
  VALUES (
    NEW.id,
    (NEW.status)::text,
    NEW.file_path,
    v_action_user_id,
    'Status alterado de ' || (OLD.status)::text || ' para ' || (NEW.status)::text
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_contract_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Deprecated: superseded by on_contract_status_change. Kept as no-op.
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_document_request_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_user_id UUID;
  v_partner_user_id UUID;
  v_client_name TEXT;
BEGIN
  SELECT user_id, full_name INTO v_client_user_id, v_client_name FROM public.clients WHERE id = NEW.client_id;

  SELECT p.user_id INTO v_partner_user_id
  FROM public.partners p
  JOIN public.clients c ON c.partner_id = p.id
  WHERE c.id = NEW.client_id;

  IF NEW.status = 'enviado' AND (OLD.status IS NULL OR OLD.status != 'enviado') THEN
    PERFORM public.notify_admins(
      'Documento Reenviado',
      'O cliente ' || v_client_name || ' reenviou: ' || NEW.request_title,
      '/documentos',
      'document'
    );
  END IF;

  IF NEW.status IN ('aprovado', 'reprovado') AND NEW.status != OLD.status THEN
    IF v_client_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, type)
      VALUES (
        v_client_user_id,
        'Documento ' || (CASE WHEN NEW.status = 'aprovado' THEN 'Aprovado' ELSE 'Reprovado' END),
        'Seu documento "' || NEW.request_title || '" foi ' || (CASE WHEN NEW.status = 'aprovado' THEN 'aprovado pela nossa equipe.' ELSE 'reprovado. Veja o motivo no painel.' END),
        '/cliente/documentos',
        'document'
      );
    END IF;

    IF v_partner_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, type)
      VALUES (
        v_partner_user_id,
        'Status de Documento Atualizado',
        'O documento "' || NEW.request_title || '" do cliente ' || v_client_name || ' foi ' || NEW.status || '.',
        '/parceiro',
        'document'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_status_report_inserted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_name TEXT;
  v_product_name TEXT;
BEGIN
  UPDATE public.client_products SET status = NEW.status, updated_at = now() WHERE id = NEW.client_product_id;

  SELECT c.full_name, COALESCE(p.name, cp.custom_product_name, '—')
  INTO v_client_name, v_product_name
  FROM public.client_products cp
  JOIN public.clients c ON c.id = cp.client_id
  LEFT JOIN public.products p ON p.id = cp.product_id
  WHERE cp.id = NEW.client_product_id;

  PERFORM public.notify_admins(
    'Status reportado pelo prestador',
    COALESCE(v_client_name,'Cliente') || ' · ' || COALESCE(v_product_name,'Produto') || ' → ' || NEW.status,
    '/demandas',
    'status_report'
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.notify_admins(
    'Novo lead recebido',
    COALESCE(NEW.full_name,'—') || COALESCE(' · ' || NEW.source,''),
    '/vendas',
    'lead'
  );
  RETURN NEW;
END;
$function$;

-- 2) Drop duplicate contract notification trigger (kept on_contract_status_change as the canonical one)
DROP TRIGGER IF EXISTS trigger_notify_on_contract_change ON public.contracts;
