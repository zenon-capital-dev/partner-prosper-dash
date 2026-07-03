
-- Notify admins whenever a partner posts a support message
CREATE OR REPLACE FUNCTION public.notify_admins_on_partner_support_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject text;
  v_partner_name text;
  v_link text;
BEGIN
  IF NEW.sender_role <> 'partner' THEN
    RETURN NEW;
  END IF;

  SELECT t.subject, COALESCE(p.name, 'Parceiro')
    INTO v_subject, v_partner_name
  FROM public.partner_support_tickets t
  LEFT JOIN public.partners p ON p.id = t.partner_id
  WHERE t.id = NEW.ticket_id;

  v_link := '/admin/parceiros-suporte';

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT ur.user_id,
         'Nova mensagem de parceiro no suporte',
         v_partner_name || ' respondeu no chamado: ' || COALESCE(v_subject, 'Suporte'),
         'info',
         v_link
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'super_admin', 'admin_secondary');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_partner_support_msg ON public.partner_support_ticket_messages;
CREATE TRIGGER trg_notify_admins_partner_support_msg
AFTER INSERT ON public.partner_support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_partner_support_message();

-- Also notify admins when a NEW ticket is opened by a partner
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_partner_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_name text;
BEGIN
  SELECT COALESCE(p.name, 'Parceiro') INTO v_partner_name
  FROM public.partners p WHERE p.id = NEW.partner_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT ur.user_id,
         'Novo chamado de suporte (parceiro)',
         v_partner_name || ' abriu: ' || NEW.subject,
         CASE WHEN NEW.priority = 'alta' THEN 'warning' ELSE 'info' END,
         '/admin/parceiros-suporte'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'super_admin', 'admin_secondary');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_partner_ticket ON public.partner_support_tickets;
CREATE TRIGGER trg_notify_admins_new_partner_ticket
AFTER INSERT ON public.partner_support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_partner_ticket();
