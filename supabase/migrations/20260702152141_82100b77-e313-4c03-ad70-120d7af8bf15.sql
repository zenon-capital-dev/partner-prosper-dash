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

  SELECT lower(translate(name, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
    INTO v_stage_name
  FROM public.client_journey_stages
  WHERE id = NEW.journey_stage_id;

  v_norm := COALESCE(v_stage_name, '');

  IF v_norm ~ '(finaliz|conclu|pos-venda|pos venda|entrega)' THEN
    NEW.status := 'finalizado'::public.client_status;
  ELSIF v_norm ~ '(pagamento pendente|pendente.*pagamento|cobranca)' THEN
    NEW.status := 'pagamento_pendente'::public.client_status;
  ELSIF v_norm ~ '(pagamento confirm|quitad|pago)' THEN
    NEW.status := 'pagamento_confirmado'::public.client_status;
  ELSIF v_norm ~ '(venda realizada|venda fechada|fechad|contrato assinado)' THEN
    NEW.status := 'ativo'::public.client_status;
  ELSIF v_norm ~ '(em atendimento|andamento|execu|operac)' THEN
    NEW.status := 'em_andamento'::public.client_status;
  ELSIF v_norm ~ '(prospecc|prospec|captac|capta|lead|proposta|diagnostico|agenda)' THEN
    NEW.status := 'prospecto'::public.client_status;
  ELSIF v_norm ~ '(inativ|sem resposta|recusad|perdid)' THEN
    NEW.status := 'inativo'::public.client_status;
  ELSIF v_norm ~ '(cancel)' THEN
    NEW.status := 'cancelado'::public.client_status;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_client_status_from_journey_stage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_client_status_from_journey_stage() TO service_role;