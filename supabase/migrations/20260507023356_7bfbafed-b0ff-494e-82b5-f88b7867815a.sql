
-- Helper: notify all admins
CREATE OR REPLACE FUNCTION public.notify_admins(p_title TEXT, p_message TEXT, p_link TEXT, p_type TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, link, type)
  SELECT ur.user_id, p_title, p_message, p_link, p_type
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
END;
$$;

-- Sales
CREATE OR REPLACE FUNCTION public.notify_on_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client TEXT;
BEGIN
  SELECT full_name INTO v_client FROM public.clients WHERE id = NEW.client_id;
  PERFORM public.notify_admins(
    'Nova venda registrada',
    'Cliente ' || COALESCE(v_client,'—') || ' · R$ ' || NEW.amount::text,
    '/vendas',
    'sale'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_sale ON public.sales;
CREATE TRIGGER trg_notify_sale AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.notify_on_sale();

-- Leads
CREATE OR REPLACE FUNCTION public.notify_on_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'Novo lead recebido',
    COALESCE(NEW.full_name,'—') || COALESCE(' · ' || NEW.source,''),
    '/leads',
    'lead'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_lead ON public.leads;
CREATE TRIGGER trg_notify_lead AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.notify_on_lead();

-- Commissions status change
CREATE OR REPLACE FUNCTION public.notify_on_commission_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('aprovada','paga') THEN
    PERFORM public.notify_admins(
      'Comissão ' || NEW.status,
      'R$ ' || NEW.amount::text,
      '/comissoes',
      'commission'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_commission ON public.commissions;
CREATE TRIGGER trg_notify_commission AFTER UPDATE ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_commission_status();

-- Contracts signed
CREATE OR REPLACE FUNCTION public.notify_on_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'assinado') THEN
    PERFORM public.notify_admins(
      CASE WHEN TG_OP='INSERT' THEN 'Novo contrato' ELSE 'Contrato assinado' END,
      COALESCE(NEW.title,'—'),
      '/contratos',
      'contract'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_contract_ins ON public.contracts;
CREATE TRIGGER trg_notify_contract_ins AFTER INSERT ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.notify_on_contract();

DROP TRIGGER IF EXISTS trg_notify_contract_upd ON public.contracts;
CREATE TRIGGER trg_notify_contract_upd AFTER UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.notify_on_contract();

-- Tasks assignment notifies the assignee
CREATE OR REPLACE FUNCTION public.notify_on_task_assign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP='INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (NEW.assigned_to, 'Nova tarefa atribuída', COALESCE(NEW.title,'—'), '/tarefas', 'task');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_ins ON public.tasks;
CREATE TRIGGER trg_notify_task_ins AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_assign();

DROP TRIGGER IF EXISTS trg_notify_task_upd ON public.tasks;
CREATE TRIGGER trg_notify_task_upd AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_assign();

-- Documents pending
CREATE OR REPLACE FUNCTION public.notify_on_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins(
    'Novo documento',
    COALESCE(NEW.title, NEW.file_name, '—'),
    '/documentos',
    'document'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_document ON public.documents;
CREATE TRIGGER trg_notify_document AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.notify_on_document();
