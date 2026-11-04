-- =====================================================================
-- Sigilo de valores para parceiro, indicador, prestador e cliente
-- ---------------------------------------------------------------------
-- Regra de negócio: parceiro, indicador e prestador só enxergam o que
-- eles têm a receber. Nunca o valor bruto da venda, custos, deduções,
-- recebimentos do cliente ou ganhos de terceiros.
--
-- O RLS protege LINHAS, não COLUNAS. Enquanto esses papéis tiverem
-- SELECT direto em sales, payments, commissions e commission_splits,
-- qualquer um deles consegue ler o bruto pela API, mesmo que a tela
-- esconda. Por isso o acesso direto sai e entra uma função única,
-- my_commission_statement(), que devolve só o permitido.
-- =====================================================================

-- 1) Remove leitura direta das tabelas de dinheiro pelos papéis externos
DROP POLICY IF EXISTS "Partner views own sales"   ON public.sales;
DROP POLICY IF EXISTS "Referrers view own sales"  ON public.sales;
-- Cliente lia a venda inteira (custo Zenon, custo do prestador, % do parceiro).
-- Ele continua vendo as próprias parcelas em payments, que é o que ele paga.
DROP POLICY IF EXISTS "Client views own sales"    ON public.sales;

DROP POLICY IF EXISTS "Partners view related payments"  ON public.payments;
DROP POLICY IF EXISTS "Referrers view related payments" ON public.payments;
DROP POLICY IF EXISTS "Providers view related payments" ON public.payments;

-- commissions.sale_value expunha o valor da venda ao parceiro
DROP POLICY IF EXISTS "Partners view own commissions" ON public.commissions;

DROP POLICY IF EXISTS "Partner view own splits"  ON public.commission_splits;
DROP POLICY IF EXISTS "Referrer view own splits" ON public.commission_splits;
DROP POLICY IF EXISTS "Provider view own splits" ON public.commission_splits;

-- 2) Extrato único do beneficiário logado (parceiro, indicador, prestador)
--    O id do beneficiário vem sempre de auth.uid(): não aceita parâmetro.
--    base_calculo só é devolvida ao parceiro, e é a base líquida
--    (valor da comissão ÷ percentual), nunca o bruto.
CREATE OR REPLACE FUNCTION public.my_commission_statement()
RETURNS TABLE (
  split_id          uuid,
  beneficiary_type  text,
  sale_id           uuid,
  client_id         uuid,
  client_name       text,
  product_name      text,
  client_product_id uuid,
  status            text,
  paid_at           timestamptz,
  created_at        timestamptz,
  percent           numeric,
  amount            numeric,
  base_calculo      numeric,
  revenue_type      text,
  recurrence_months integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT 'partner'::text AS kind, p.id
      FROM public.partners p
     WHERE p.user_id = auth.uid()
        OR (p.email IS NOT NULL AND lower(p.email) = lower(auth.jwt() ->> 'email'))
    UNION
    SELECT 'referrer', r.id
      FROM public.referrers r
     WHERE r.user_id = auth.uid()
        OR (r.email IS NOT NULL AND lower(r.email) = lower(auth.jwt() ->> 'email'))
    UNION
    -- indicadores antigos gravavam o próprio user id como beneficiário
    SELECT 'referrer', auth.uid() WHERE auth.uid() IS NOT NULL
    UNION
    SELECT 'service_provider', sp.id
      FROM public.service_providers sp
     WHERE sp.user_id = auth.uid()
        OR (sp.email IS NOT NULL AND lower(sp.email) = lower(auth.jwt() ->> 'email'))
  )
  SELECT
    cs.id,
    cs.beneficiary_type::text,
    cs.sale_id,
    COALESCE(s.client_id, cs.client_id, cp.client_id),
    c.full_name,
    COALESCE(pr.name, cp.custom_product_name),
    COALESCE(cs.client_product_id, cp.id),
    cs.status::text,
    cs.paid_at,
    cs.created_at,
    cs.percent,
    cs.amount,
    CASE
      WHEN cs.beneficiary_type = 'partner' AND COALESCE(cs.percent, 0) > 0
        THEN round(cs.amount * 100 / cs.percent, 2)
    END,
    s.revenue_type,
    s.recurrence_months
  FROM public.commission_splits cs
  JOIN me ON me.kind = cs.beneficiary_type::text AND me.id = cs.beneficiary_id
  LEFT JOIN public.sales s ON s.id = cs.sale_id
  LEFT JOIN LATERAL (
    SELECT x.id, x.client_id, x.product_id, x.custom_product_name
      FROM public.client_products x
     WHERE x.id = cs.client_product_id
        OR (cs.client_product_id IS NULL AND cs.sale_id IS NOT NULL AND x.sale_id = cs.sale_id)
     ORDER BY (x.id = cs.client_product_id) DESC NULLS LAST, x.created_at
     LIMIT 1
  ) cp ON true
  LEFT JOIN public.clients c   ON c.id  = COALESCE(s.client_id, cs.client_id, cp.client_id)
  LEFT JOIN public.products pr ON pr.id = COALESCE(s.product_id, cp.product_id)
  WHERE auth.uid() IS NOT NULL
  ORDER BY cs.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.my_commission_statement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_commission_statement() TO authenticated;

-- 3) Prestador: o "LTV" do perfil do cliente era a soma do valor de TODOS os
--    contratos do cliente. Passa a ser só o que o prestador tem a receber.
CREATE OR REPLACE FUNCTION public.provider_client_profiles()
 RETURNS TABLE(client_id uuid, full_name text, document text, birth_date date, email text, phone text, whatsapp text, company text, address_street text, address_number text, address_neighborhood text, city text, state text, address_zip_code text, source text, status text, created_at timestamp with time zone, ltv numeric, demands jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT sp.id
    FROM public.service_providers sp
    WHERE sp.user_id = auth.uid()
  ),
  my_demands AS (
    SELECT cp.id, cp.client_id
    FROM public.client_products cp
    WHERE EXISTS (SELECT 1 FROM me)
      AND (
        private.is_delegated_provider(auth.uid(), cp.id)
        OR public.provider_has_demand_access(auth.uid(), cp.id)
      )
  ),
  shared_clients AS (
    SELECT DISTINCT d.client_id
    FROM public.document_shares ds
    JOIN public.documents d ON d.id = ds.document_id
    WHERE ds.provider_id IN (SELECT id FROM me)
      AND (ds.expires_at IS NULL OR ds.expires_at > now())
      AND d.client_id IS NOT NULL
  ),
  my_clients AS (
    SELECT client_id FROM my_demands
    UNION
    SELECT client_id FROM shared_clients
  )
  SELECT
    c.id,
    c.full_name,
    c.document,
    c.birth_date::date,
    c.email,
    c.phone,
    c.whatsapp,
    c.company,
    COALESCE(c.address_street, c.address),
    c.address_number,
    c.address_neighborhood,
    COALESCE(c.city, c.address_city),
    COALESCE(c.state, c.address_state),
    c.address_zip_code,
    c.source,
    c.status::text,
    c.created_at,
    (SELECT COALESCE(SUM(cs.amount), 0)
       FROM public.commission_splits cs
       LEFT JOIN public.sales s ON s.id = cs.sale_id
      WHERE cs.beneficiary_type = 'service_provider'
        AND cs.beneficiary_id IN (SELECT id FROM me)
        AND cs.status <> 'cancelado'
        AND COALESCE(s.client_id, cs.client_id) = c.id),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', cp.id,
               'name', COALESCE(p.name, cp.custom_product_name, 'Demanda'),
               'status', cp.status,
               'created_at', cp.created_at
             ) ORDER BY cp.created_at)
      FROM public.client_products cp
      LEFT JOIN public.products p ON p.id = cp.product_id
      WHERE cp.client_id = c.id
        AND cp.id IN (SELECT id FROM my_demands)
    ), '[]'::jsonb)
  FROM public.clients c
  WHERE c.id IN (SELECT client_id FROM my_clients)
  ORDER BY COALESCE(NULLIF(c.company, ''), c.full_name);
$function$;

-- 4) Prestador: dossiê do cliente deixa de devolver o valor da demanda e o valor do contrato
CREATE OR REPLACE FUNCTION public.provider_client_dossier(_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;