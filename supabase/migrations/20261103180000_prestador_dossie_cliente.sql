-- Ficha do cliente no painel do prestador (aba Clientes).
-- Devolve, só leitura, os dados das abas Empresas, Produtos/Demandas, Entregas
-- e Contratos de UM cliente, limitado ao que o prestador logado atende:
--   * demandas: apenas as dele (responsável, secundário, vinculado ou convidado);
--   * entregas: apenas das demandas dele;
--   * contratos: apenas os ligados às demandas dele ou ao próprio prestador.
-- Se o prestador não atende o cliente (nem recebeu documento dele), devolve NULL.
-- Não altera tabelas, políticas nem triggers.

CREATE OR REPLACE FUNCTION public.provider_client_dossier(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_provider_ids uuid[];
  v_demand_ids uuid[];
  v_has_share boolean;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR _client_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(sp.id) INTO v_provider_ids
  FROM public.service_providers sp
  WHERE sp.user_id = v_uid;

  IF v_provider_ids IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(cp.id) INTO v_demand_ids
  FROM public.client_products cp
  WHERE cp.client_id = _client_id
    AND (
      private.is_delegated_provider(v_uid, cp.id)
      OR public.provider_has_demand_access(v_uid, cp.id)
    );

  SELECT EXISTS (
    SELECT 1
    FROM public.document_shares ds
    JOIN public.documents d ON d.id = ds.document_id
    WHERE ds.provider_id = ANY (v_provider_ids)
      AND (ds.expires_at IS NULL OR ds.expires_at > now())
      AND d.client_id = _client_id
  ) INTO v_has_share;

  IF v_demand_ids IS NULL AND NOT v_has_share THEN
    RETURN NULL;
  END IF;

  v_demand_ids := COALESCE(v_demand_ids, ARRAY[]::uuid[]);

  SELECT jsonb_build_object(
    'client', (
      SELECT jsonb_build_object(
        'id', c.id,
        'full_name', c.full_name,
        'company', c.company,
        'document', c.document,
        'email', c.email,
        'phone', c.phone,
        'whatsapp', c.whatsapp,
        'status', c.status::text,
        'source', c.source,
        'created_at', c.created_at,
        'city', COALESCE(c.city, c.address_city),
        'state', COALESCE(c.state, c.address_state)
      )
      FROM public.clients c
      WHERE c.id = _client_id
    ),
    'companies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', co.id,
               'name', co.name,
               'trade_name', co.trade_name,
               'document', co.document,
               'email', co.email,
               'phone', co.phone,
               'address_street', co.address_street,
               'address_number', co.address_number,
               'address_neighborhood', co.address_neighborhood,
               'address_city', co.address_city,
               'address_state', co.address_state,
               'address_zip_code', co.address_zip_code
             ) ORDER BY co.created_at DESC)
      FROM public.companies co
      WHERE co.client_id = _client_id
    ), '[]'::jsonb),
    'demands', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', cp.id,
               'name', COALESCE(p.name, cp.custom_product_name, 'Demanda'),
               'status', cp.status,
               'priority', cp.priority,
               'value', cp.value,
               'deadline', cp.deadline,
               'sla_due_date', cp.sla_due_date,
               'end_date', cp.end_date,
               'created_at', cp.created_at
             ) ORDER BY cp.created_at DESC)
      FROM public.client_products cp
      LEFT JOIN public.products p ON p.id = cp.product_id
      WHERE cp.id = ANY (v_demand_ids)
    ), '[]'::jsonb),
    'deliveries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', dd.id,
               'client_product_id', dd.client_product_id,
               'title', dd.title,
               'description', dd.description,
               'status', dd.status,
               'files', dd.files,
               'file_url', dd.file_url,
               'created_at', dd.created_at
             ) ORDER BY dd.created_at DESC)
      FROM public.demand_deliveries dd
      WHERE dd.client_product_id = ANY (v_demand_ids)
    ), '[]'::jsonb),
    'contracts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', ct.id,
               'client_product_id', ct.client_product_id,
               'name', ct.name,
               'contract_type', ct.contract_type,
               'status', ct.status::text,
               'amount', ct.amount,
               'sent_at', ct.sent_at,
               'signed_at', ct.signed_at,
               'expires_at', ct.expires_at,
               'file_path', ct.file_path,
               'signed_file_path', ct.signed_file_path,
               'created_at', ct.created_at
             ) ORDER BY ct.created_at DESC)
      FROM public.contracts ct
      WHERE ct.client_id = _client_id
        AND (ct.client_product_id = ANY (v_demand_ids) OR ct.provider_id = ANY (v_provider_ids))
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.provider_client_dossier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_client_dossier(uuid) TO authenticated;
