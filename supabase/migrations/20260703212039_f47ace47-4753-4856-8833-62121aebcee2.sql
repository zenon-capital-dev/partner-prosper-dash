
-- ============== PRESTADOR: atribuído a demanda ==============
CREATE OR REPLACE FUNCTION public.notify_provider_on_demand_assign()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_client text; v_prod text;
BEGIN
  IF NEW.service_provider_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.service_provider_id IS NOT DISTINCT FROM OLD.service_provider_id THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.service_providers WHERE id = NEW.service_provider_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  SELECT c.name INTO v_client FROM public.clients c WHERE c.id = NEW.client_id;
  v_prod := COALESCE(NEW.custom_product_name, '—');
  INSERT INTO public.notifications (user_id, title, message, link, type)
  VALUES (v_user, 'Nova demanda atribuída',
    COALESCE(v_client,'Cliente') || ' — ' || v_prod, '/prestador', 'info');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_provider_demand_assign ON public.client_products;
CREATE TRIGGER trg_notify_provider_demand_assign
AFTER INSERT OR UPDATE OF service_provider_id ON public.client_products
FOR EACH ROW EXECUTE FUNCTION public.notify_provider_on_demand_assign();

-- ============== PRESTADOR: cliente enviou documento ==============
CREATE OR REPLACE FUNCTION public.notify_provider_on_client_document_upload()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_provider_user uuid; v_prod text;
BEGIN
  IF NEW.source IS DISTINCT FROM 'client_upload' THEN RETURN NEW; END IF;
  IF NEW.client_product_id IS NULL THEN RETURN NEW; END IF;
  SELECT sp.user_id, COALESCE(cp.custom_product_name,'—')
    INTO v_provider_user, v_prod
  FROM public.client_products cp
  LEFT JOIN public.service_providers sp ON sp.id = cp.service_provider_id
  WHERE cp.id = NEW.client_product_id;
  IF v_provider_user IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, message, link, type)
  VALUES (v_provider_user, 'Cliente enviou documento',
    v_prod || ': ' || COALESCE(NEW.name,'arquivo'),
    '/prestador', 'document');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_provider_client_doc ON public.documents;
CREATE TRIGGER trg_notify_provider_client_doc
AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.notify_provider_on_client_document_upload();

-- ============== CLIENTE: nova entrega ==============
CREATE OR REPLACE FUNCTION public.notify_client_on_new_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_prod text;
BEGIN
  SELECT c.user_id, COALESCE(cp.custom_product_name,'—')
    INTO v_user, v_prod
  FROM public.client_products cp
  JOIN public.clients c ON c.id = cp.client_id
  WHERE cp.id = NEW.client_product_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, message, link, type)
  VALUES (v_user, 'Nova entrega disponível',
    v_prod || ': ' || COALESCE(NEW.title,'entrega'),
    '/portal-cliente', 'delivery');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_client_delivery ON public.demand_deliveries;
CREATE TRIGGER trg_notify_client_delivery
AFTER INSERT ON public.demand_deliveries
FOR EACH ROW EXECUTE FUNCTION public.notify_client_on_new_delivery();

-- ============== PARCEIRO: admin respondeu no suporte ==============
CREATE OR REPLACE FUNCTION public.notify_partner_on_admin_ticket_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_subject text;
BEGIN
  IF NEW.sender_role <> 'admin' THEN RETURN NEW; END IF;
  SELECT t.user_id, t.subject INTO v_user, v_subject
  FROM public.partner_support_tickets t WHERE t.id = NEW.ticket_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, message, link, type)
  VALUES (v_user, 'Equipe respondeu seu chamado',
    COALESCE(v_subject,'Suporte'), '/parceiro', 'info');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_partner_admin_reply ON public.partner_support_ticket_messages;
CREATE TRIGGER trg_notify_partner_admin_reply
AFTER INSERT ON public.partner_support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_partner_on_admin_ticket_reply();

-- ============== PARCEIRO: novo material ==============
CREATE OR REPLACE FUNCTION public.notify_partners_on_new_material()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active = false THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id, 'Novo material disponível',
         COALESCE(NEW.title,'material'), '/parceiro', 'info'
  FROM public.user_roles ur
  WHERE ur.role = 'parceiro';
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_partners_new_material ON public.partner_materials;
CREATE TRIGGER trg_notify_partners_new_material
AFTER INSERT ON public.partner_materials
FOR EACH ROW EXECUTE FUNCTION public.notify_partners_on_new_material();

-- ============== PARCEIRO: contrato aprovado ==============
CREATE OR REPLACE FUNCTION public.notify_partner_on_contract_signed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'assinado' THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.partners WHERE id = NEW.partner_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, message, link, type)
  VALUES (v_user, 'Contrato aprovado',
    'Seu contrato de parceria foi assinado e aprovado.',
    '/parceiro', 'success');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_partner_contract_signed ON public.partner_contracts;
CREATE TRIGGER trg_notify_partner_contract_signed
AFTER UPDATE OF status ON public.partner_contracts
FOR EACH ROW EXECUTE FUNCTION public.notify_partner_on_contract_signed();

-- ============== COLABORADOR: atribuído a demanda ==============
CREATE OR REPLACE FUNCTION public.notify_collaborator_on_demand_assign()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client text; v_prod text;
BEGIN
  IF NEW.responsible_employee_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.responsible_employee_id IS NOT DISTINCT FROM OLD.responsible_employee_id THEN RETURN NEW; END IF;
  SELECT c.name INTO v_client FROM public.clients c WHERE c.id = NEW.client_id;
  v_prod := COALESCE(NEW.custom_product_name,'—');
  INSERT INTO public.notifications (user_id, title, message, link, type)
  VALUES (NEW.responsible_employee_id, 'Nova demanda atribuída',
    COALESCE(v_client,'Cliente') || ' — ' || v_prod, '/colaborador', 'info');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_collab_demand_assign ON public.client_products;
CREATE TRIGGER trg_notify_collab_demand_assign
AFTER INSERT OR UPDATE OF responsible_employee_id ON public.client_products
FOR EACH ROW EXECUTE FUNCTION public.notify_collaborator_on_demand_assign();

-- ============== COLABORADOR: status de demanda mudou ==============
CREATE OR REPLACE FUNCTION public.notify_collaborator_on_demand_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.responsible_employee_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, message, link, type)
  VALUES (NEW.responsible_employee_id, 'Status da demanda atualizado',
    COALESCE(NEW.custom_product_name,'—') || ': ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—'),
    '/colaborador', 'status');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_collab_demand_status ON public.client_products;
CREATE TRIGGER trg_notify_collab_demand_status
AFTER UPDATE OF status ON public.client_products
FOR EACH ROW EXECUTE FUNCTION public.notify_collaborator_on_demand_status_change();

-- ============== COLABORADOR: comentário em tarefa ==============
CREATE OR REPLACE FUNCTION public.notify_assignee_on_task_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_assignee uuid; v_title text;
BEGIN
  SELECT assigned_to, title INTO v_assignee, v_title FROM public.tasks WHERE id = NEW.task_id;
  IF v_assignee IS NULL OR v_assignee = NEW.author_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, message, link, type)
  VALUES (v_assignee, 'Novo comentário em tarefa',
    COALESCE(v_title,'Tarefa'), '/colaborador', 'task');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_task_comment ON public.task_comments;
CREATE TRIGGER trg_notify_task_comment
AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_assignee_on_task_comment();
