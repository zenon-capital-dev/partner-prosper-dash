
-- Permite ao cliente atualizar apenas seus próprios dados de contato
CREATE POLICY "Client updates own record"
ON public.clients
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para impedir alteração de campos sensíveis pelo próprio cliente
CREATE OR REPLACE FUNCTION public.clients_client_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só aplica quando o próprio cliente está atualizando (não admin/vendedor)
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'super_admin')) THEN
    NEW.user_id        := OLD.user_id;
    NEW.partner_id     := OLD.partner_id;
    NEW.status         := OLD.status;
    NEW.responsible_employee_id := OLD.responsible_employee_id;
    NEW.created_at     := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_client_self_update_guard ON public.clients;
CREATE TRIGGER trg_clients_client_self_update_guard
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_client_self_update_guard();
