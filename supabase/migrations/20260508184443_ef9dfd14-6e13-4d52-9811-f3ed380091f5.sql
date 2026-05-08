-- Add notification trigger for document request status changes
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
  -- Get client user_id and name
  SELECT user_id, full_name INTO v_client_user_id, v_client_name FROM public.clients WHERE id = NEW.client_id;
  
  -- Get partner user_id if exists
  SELECT p.user_id INTO v_partner_user_id 
  FROM public.partners p
  JOIN public.clients c ON c.partner_id = p.id
  WHERE c.id = NEW.client_id;

  -- Notify Admins on re-submission (enviado)
  IF NEW.status = 'enviado' AND (OLD.status IS NULL OR OLD.status != 'enviado') THEN
    PERFORM public.notify_admins(
      'Documento Reenviado',
      'O cliente ' || v_client_name || ' reenviou: ' || NEW.request_title,
      '/documentos',
      'document'
    );
  END IF;

  -- Notify Client and Partner on status change to 'aprovado' or 'reprovado'
  IF NEW.status IN ('aprovado', 'reprovado') AND NEW.status != OLD.status THEN
    -- To Client
    IF v_client_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, type)
      VALUES (
        v_client_user_id, 
        'Documento ' || (CASE WHEN NEW.status = 'aprovado' THEN 'Aprovado' ELSE 'Reprovado' END),
        'Seu documento "' || NEW.request_title || '" foi ' || (CASE WHEN NEW.status = 'aprovado' THEN 'aprovado pela nossa equipe.' ELSE 'reprovado. Veja o motivo no painel.' END),
        '/painel-cliente',
        'document'
      );
    END IF;

    -- To Partner
    IF v_partner_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, type)
      VALUES (
        v_partner_user_id, 
        'Status de Documento Atualizado',
        'O documento "' || NEW.request_title || '" do cliente ' || v_client_name || ' foi ' || NEW.status || '.',
        '/painel-parceiro',
        'document'
      );
    END IF;
  END IF;

  RETURN NEW;
END; $function$;

CREATE TRIGGER trigger_notify_on_document_request_change
AFTER UPDATE ON public.document_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_document_request_change();

-- Add validation settings to products if not exist
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS doc_max_size_mb INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS doc_allowed_types TEXT[] DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png'];
