-- Trigger function for automatic notifications and auditing of contract changes
CREATE OR REPLACE FUNCTION public.on_contract_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_client_user_id UUID;
  v_partner_user_id UUID;
  v_client_name TEXT;
  v_action_user_id UUID;
BEGIN
  v_action_user_id := auth.uid();

  -- Get essential info
  SELECT user_id, full_name INTO v_client_user_id, v_client_name FROM public.clients WHERE id = NEW.client_id;
  
  SELECT p.user_id INTO v_partner_user_id 
  FROM public.partners p
  JOIN public.clients c ON c.partner_id = p.id
  WHERE c.id = NEW.client_id;

  -- 1. NOTIFICATIONS
  -- To Client (if contract becomes 'enviado' or 'assinado' or 'pendente_correcao')
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
      '/painel-cliente',
      'contract'
    );
  END IF;

  -- To Partner (if contract is 'assinado')
  IF NEW.status::text = 'assinado' AND OLD.status::text != 'assinado' AND v_partner_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (
      v_partner_user_id,
      'Seu Cliente Assinou!',
      'O cliente ' || v_client_name || ' assinou o contrato "' || NEW.name || '".',
      '/painel-parceiro',
      'contract'
    );
  END IF;

  -- 2. AUDIT LOGGING
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    v_action_user_id,
    'CONTRACT_UPDATE',
    'contracts',
    NEW.id,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );

  -- 3. HISTORY PERSISTENCE
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to contracts
DROP TRIGGER IF EXISTS tr_on_contract_status_change ON public.contracts;
CREATE TRIGGER tr_on_contract_status_change
AFTER UPDATE OF status, file_path ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.on_contract_status_change();

-- Refine RLS for Storage (contracts bucket)
DROP POLICY IF EXISTS "Clients read own contracts" ON storage.objects;
CREATE POLICY "Clients read own contracts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contracts'
  AND (
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.clients WHERE user_id = auth.uid())
    OR public.is_admin()
    OR public.has_role(ARRAY['vendedor', 'colaborador'])
  )
);

-- Fix Search Paths for remaining functions to satisfy linter
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_new_sale() SET search_path = public;
ALTER FUNCTION public.notify_on_lead() SET search_path = public;
ALTER FUNCTION public.notify_on_sale() SET search_path = public;
ALTER FUNCTION public.notify_on_document() SET search_path = public;
ALTER FUNCTION public.notify_on_contract() SET search_path = public;
ALTER FUNCTION public.notify_on_commission_status() SET search_path = public;
ALTER FUNCTION public.notify_on_task_assign() SET search_path = public;
