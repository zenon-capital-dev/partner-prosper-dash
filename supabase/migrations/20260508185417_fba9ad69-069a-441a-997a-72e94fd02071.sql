-- Contract History for Audit
CREATE TABLE IF NOT EXISTS public.contract_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
    file_path TEXT,
    status TEXT NOT NULL,
    action_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_history ENABLE ROW LEVEL SECURITY;

-- Policies for contract_history
CREATE POLICY "Admin/Vendedor manage contract history"
ON public.contract_history FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::app_role));

CREATE POLICY "Client view own contract history"
ON public.contract_history FOR SELECT TO authenticated
USING (
    contract_id IN (
        SELECT id FROM public.contracts 
        WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
);

-- Realtime notification trigger for contracts
CREATE OR REPLACE FUNCTION public.notify_on_contract_change()
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
  -- Get client info
  SELECT user_id, full_name INTO v_client_user_id, v_client_name FROM public.clients WHERE id = NEW.client_id;
  
  -- Get partner info
  SELECT p.user_id INTO v_partner_user_id 
  FROM public.partners p
  JOIN public.clients c ON c.partner_id = p.id
  WHERE c.id = NEW.client_id;

  -- Notify Admin on signature
  IF (NEW.status)::text = 'assinado' AND (OLD.status)::text != 'assinado' THEN
    PERFORM public.notify_admins(
      'Contrato Assinado',
      'O cliente ' || v_client_name || ' assinou o contrato: ' || NEW.name,
      '/contratos',
      'contract'
    );
  END IF;

  -- Notify Client when contract is 'enviado' (ready for signature)
  IF (NEW.status)::text = 'enviado' AND (OLD.status)::text != 'enviado' THEN
    IF v_client_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, link, type)
      VALUES (
        v_client_user_id, 
        'Novo Contrato Disponível',
        'O contrato "' || NEW.name || '" está disponível para sua assinatura.',
        '/painel-cliente',
        'contract'
      );
    END IF;
  END IF;

  -- Notify Partner on signature
  IF (NEW.status)::text = 'assinado' AND (OLD.status)::text != 'assinado' AND v_partner_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (
      v_partner_user_id, 
      'Contrato Assinado por Cliente',
      'Seu cliente indicado ' || v_client_name || ' assinou o contrato "' || NEW.name || '".',
      '/painel-parceiro',
      'contract'
    );
  END IF;

  -- Log to audit_logs
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    auth.uid(),
    'CONTRACT_STATUS_CHANGE',
    'contracts',
    NEW.id,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );

  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trigger_notify_on_contract_change ON public.contracts;
CREATE TRIGGER trigger_notify_on_contract_change
AFTER UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_contract_change();

-- Add bucket policy for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Clients read own contracts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contracts'
  AND (
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.clients WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'vendedor'::app_role)
  )
);

CREATE POLICY "Admins manage all contracts storage"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'contracts' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::app_role)))
WITH CHECK (bucket_id = 'contracts' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::app_role)));
