CREATE OR REPLACE FUNCTION public.sync_client_status_from_journey_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_name text;
  v_norm text;
BEGIN
  IF NEW.journey_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lower(unaccent(name)) INTO v_stage_name
  FROM public.client_journey_stages
  WHERE id = NEW.journey_stage_id;

  v_norm := COALESCE(v_stage_name, '');

  IF v_norm ~ '(finaliz|conclu|pos-venda|pos venda|entrega)' THEN
    NEW.status := 'finalizado'::public.client_status;
  ELSIF v_norm ~ '(pagamento pendente|pendente.*pagamento|cobranca|cobrança)' THEN
    NEW.status := 'pagamento_pendente'::public.client_status;
  ELSIF v_norm ~ '(pagamento confirm|quitad|pago)' THEN
    NEW.status := 'pagamento_confirmado'::public.client_status;
  ELSIF v_norm ~ '(venda realizada|venda fechada|fechad|contrato assinado)' THEN
    NEW.status := 'ativo'::public.client_status;
  ELSIF v_norm ~ '(em atendimento|andamento|execu|operac)' THEN
    NEW.status := 'em_andamento'::public.client_status;
  ELSIF v_norm ~ '(prospecc|prospec|captac|capta|lead|proposta|diagnostico|diagnóstico|agenda)' THEN
    NEW.status := 'prospecto'::public.client_status;
  ELSIF v_norm ~ '(inativ|sem resposta|recusad|perdid)' THEN
    NEW.status := 'inativo'::public.client_status;
  ELSIF v_norm ~ '(cancel)' THEN
    NEW.status := 'cancelado'::public.client_status;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_client_status_from_journey_stage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_client_status_from_journey_stage() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_sync_client_status_from_stage ON public.clients;
CREATE TRIGGER trg_sync_client_status_from_stage
BEFORE INSERT OR UPDATE OF journey_stage_id ON public.clients
FOR EACH ROW
WHEN (NEW.journey_stage_id IS NOT NULL)
EXECUTE FUNCTION public.sync_client_status_from_journey_stage();