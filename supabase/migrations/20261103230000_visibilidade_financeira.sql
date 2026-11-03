-- =====================================================================
-- Visibilidade financeira: o admin decide quem vê o quê
-- ---------------------------------------------------------------------
-- Padrão: ninguém de fora vê nada além do que tem a receber.
-- O admin libera, por pessoa (cadastro) e com ajuste por venda:
--   see_gross       valor bruto da venda
--   see_payments    parcelas do cliente: o que foi pago e o que está em aberto
--   see_deductions  deduções da venda (imposto, jurídico, sistema, PJ...)
-- Exemplo: jurídico vê o valor total; parceiro comercial só a base líquida.
--
-- As tabelas de permissão são só do admin. A pessoa não consegue se
-- liberar sozinha. Tudo é entregue por funções que leem auth.uid().
-- =====================================================================

-- 1) Padrão no cadastro de cada pessoa
CREATE TABLE IF NOT EXISTS public.financial_visibility (
  beneficiary_type text NOT NULL CHECK (beneficiary_type IN ('partner','referrer','service_provider')),
  beneficiary_id   uuid NOT NULL,
  see_gross        boolean NOT NULL DEFAULT false,
  see_payments     boolean NOT NULL DEFAULT false,
  see_deductions   boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid DEFAULT auth.uid(),
  PRIMARY KEY (beneficiary_type, beneficiary_id)
);

-- 2) Ajuste por venda (NULL = segue o cadastro)
CREATE TABLE IF NOT EXISTS public.sale_visibility_overrides (
  sale_id          uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  beneficiary_type text NOT NULL CHECK (beneficiary_type IN ('partner','referrer','service_provider')),
  beneficiary_id   uuid NOT NULL,
  see_gross        boolean,
  see_payments     boolean,
  see_deductions   boolean,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sale_id, beneficiary_type, beneficiary_id)
);

ALTER TABLE public.financial_visibility      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_visibility_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_visibility, public.sale_visibility_overrides FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_visibility, public.sale_visibility_overrides TO authenticated;

DROP POLICY IF EXISTS "Somente admin: visibilidade por pessoa" ON public.financial_visibility;
CREATE POLICY "Somente admin: visibilidade por pessoa" ON public.financial_visibility
  FOR ALL TO authenticated
  USING (private.is_admin((SELECT auth.uid()))) WITH CHECK (private.is_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "Somente admin: visibilidade por venda" ON public.sale_visibility_overrides;
CREATE POLICY "Somente admin: visibilidade por venda" ON public.sale_visibility_overrides
  FOR ALL TO authenticated
  USING (private.is_admin((SELECT auth.uid()))) WITH CHECK (private.is_admin((SELECT auth.uid())));

-- 3) Quem é o usuário logado (pode ser parceiro, indicador e prestador ao mesmo tempo)
CREATE OR REPLACE FUNCTION private.my_beneficiaries()
RETURNS TABLE (kind text, id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'partner'::text, p.id FROM public.partners p
   WHERE auth.uid() IS NOT NULL
     AND (p.user_id = auth.uid() OR (p.email IS NOT NULL AND lower(p.email) = lower(auth.jwt() ->> 'email')))
  UNION
  SELECT 'referrer', r.id FROM public.referrers r
   WHERE auth.uid() IS NOT NULL
     AND (r.user_id = auth.uid() OR (r.email IS NOT NULL AND lower(r.email) = lower(auth.jwt() ->> 'email')))
  UNION
  -- indicadores antigos gravavam o próprio user id como beneficiário
  SELECT 'referrer', auth.uid() WHERE auth.uid() IS NOT NULL
  UNION
  SELECT 'service_provider', sp.id FROM public.service_providers sp
   WHERE auth.uid() IS NOT NULL
     AND (sp.user_id = auth.uid() OR (sp.email IS NOT NULL AND lower(sp.email) = lower(auth.jwt() ->> 'email')));
$$;
REVOKE ALL ON FUNCTION private.my_beneficiaries() FROM PUBLIC, anon, authenticated;

-- 4) Permissão efetiva numa venda: ajuste da venda > cadastro > bloqueado
CREATE OR REPLACE FUNCTION private.effective_visibility(p_sale_id uuid, p_kind text, p_id uuid)
RETURNS TABLE (see_gross boolean, see_payments boolean, see_deductions boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(o.see_gross,      d.see_gross,      false),
         COALESCE(o.see_payments,   d.see_payments,   false),
         COALESCE(o.see_deductions, d.see_deductions, false)
    FROM (SELECT 1) one
    LEFT JOIN public.financial_visibility d
           ON d.beneficiary_type = p_kind AND d.beneficiary_id = p_id
    LEFT JOIN public.sale_visibility_overrides o
           ON o.sale_id = p_sale_id AND o.beneficiary_type = p_kind AND o.beneficiary_id = p_id;
$$;
REVOKE ALL ON FUNCTION private.effective_visibility(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

-- 5) Extrato com o que foi liberado. Recriada porque mudam as colunas.
DROP FUNCTION IF EXISTS public.my_commission_statement();
CREATE FUNCTION public.my_commission_statement()
RETURNS TABLE (
  split_id           uuid,
  beneficiary_type   text,
  sale_id            uuid,
  client_id          uuid,
  client_name        text,
  product_name       text,
  client_product_id  uuid,
  status             text,
  paid_at            timestamptz,
  created_at         timestamptz,
  percent            numeric,
  amount             numeric,
  base_calculo       numeric,
  revenue_type       text,
  recurrence_months  integer,
  gross_amount       numeric,   -- só quando liberado
  can_see_payments   boolean,
  can_see_deductions boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    s.recurrence_months,
    CASE WHEN v.see_gross THEN s.amount END,
    COALESCE(v.see_payments, false)   AND cs.sale_id IS NOT NULL,
    COALESCE(v.see_deductions, false) AND cs.sale_id IS NOT NULL
  FROM public.commission_splits cs
  JOIN private.my_beneficiaries() me ON me.kind = cs.beneficiary_type::text AND me.id = cs.beneficiary_id
  LEFT JOIN public.sales s ON s.id = cs.sale_id
  LEFT JOIN LATERAL private.effective_visibility(cs.sale_id, cs.beneficiary_type::text, cs.beneficiary_id) v ON true
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
  ORDER BY cs.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.my_commission_statement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_commission_statement() TO authenticated;

-- 6) Detalhe de uma venda, só com o que foi liberado para quem está logado.
--    Quem não participa da venda recebe NULL.
CREATE OR REPLACE FUNCTION public.my_sale_disclosure(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross boolean := false;
  v_pay   boolean := false;
  v_ded   boolean := false;
  v_sale  record;
  v_out   jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_sale_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Participa da venda? (por algum papel) e soma das liberações
  SELECT bool_or(v.see_gross), bool_or(v.see_payments), bool_or(v.see_deductions)
    INTO v_gross, v_pay, v_ded
    FROM public.commission_splits cs
    JOIN private.my_beneficiaries() me ON me.kind = cs.beneficiary_type::text AND me.id = cs.beneficiary_id
    CROSS JOIN LATERAL private.effective_visibility(cs.sale_id, cs.beneficiary_type::text, cs.beneficiary_id) v
   WHERE cs.sale_id = p_sale_id;

  IF v_gross IS NULL THEN
    RETURN NULL;  -- não participa
  END IF;

  SELECT id, amount, revenue_type, recurrence_months INTO v_sale FROM public.sales WHERE id = p_sale_id;

  v_out := jsonb_build_object('sale_id', p_sale_id);

  IF v_gross THEN
    v_out := v_out || jsonb_build_object(
      'gross_amount', v_sale.amount,
      'revenue_type', v_sale.revenue_type,
      'recurrence_months', v_sale.recurrence_months);
  END IF;

  IF v_pay THEN
    v_out := v_out || jsonb_build_object('payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'installment_number', p.installment_number,
               'installments_count', p.installments_count,
               'due_date', p.due_date,
               'amount', p.amount,
               'amount_paid', p.amount_paid,
               'paid_at', p.paid_at,
               'status', p.status::text
             ) ORDER BY p.due_date NULLS LAST, p.installment_number)
        FROM public.payments p
       WHERE p.sale_id = p_sale_id
         AND p.status::text NOT IN ('cancelado','cancelada')
    ), '[]'::jsonb));
  END IF;

  IF v_ded THEN
    v_out := v_out || jsonb_build_object('deductions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'name', t.name,
               'percent', d.percent,
               'amount', COALESCE(d.fixed_amount, round(COALESCE(v_sale.amount, 0) * d.percent / 100, 2))
             ) ORDER BY t.sort_order, t.name)
        FROM public.sale_deductions d
        JOIN public.deduction_types t ON t.id = d.deduction_type_id
       WHERE d.sale_id = p_sale_id
    ), '[]'::jsonb));
  END IF;

  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.my_sale_disclosure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_sale_disclosure(uuid) TO authenticated;
