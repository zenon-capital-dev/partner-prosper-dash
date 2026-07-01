
CREATE OR REPLACE FUNCTION public.notify_admins_on_partner_ticket_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject text;
  v_partner_name text;
  admin_id uuid;
BEGIN
  IF NEW.sender_role <> 'partner' THEN
    RETURN NEW;
  END IF;

  SELECT t.subject, COALESCE(p.name, 'Parceiro')
    INTO v_subject, v_partner_name
  FROM public.partner_support_tickets t
  LEFT JOIN public.partners p ON p.id = t.partner_id
  WHERE t.id = NEW.ticket_id;

  FOR admin_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      admin_id,
      'Nova mensagem de parceiro',
      v_partner_name || ' respondeu no chamado: ' || COALESCE(v_subject, ''),
      'info',
      '/admin/parceiros/suporte'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_partner_ticket_msg ON public.partner_support_ticket_messages;
CREATE TRIGGER trg_notify_admins_partner_ticket_msg
AFTER INSERT ON public.partner_support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_partner_ticket_message();
