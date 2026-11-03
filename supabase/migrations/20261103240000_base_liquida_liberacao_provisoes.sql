-- =====================================================================
-- 1) Indicador e colaborador sobre a base líquida (vendas na cascata)
-- 2) Comissão liberada na proporção do que o cliente pagou
-- 3) Provisões da venda viram contas a pagar em Despesas
-- Vendas antigas (modelo legado) não mudam de base.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Base líquida para indicador e colaborador
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_sale_splits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_base numeric(12,2);
  v_partner_amount numeric(12,2);
  v_referrer_amount numeric(12,2);
  v_collab_amount numeric(12,2);
  v_provider_amount numeric(12,2);
BEGIN
  -- Só venda finalizada entra na esteira financeira de repasses.
  IF NEW.status::text <> 'concluida' THEN
    UPDATE public.commission_splits
       SET status = 'cancelado'::split_status,
           paid_at = NULL,
           updated_at = now()
     WHERE sale_id = NEW.id
       AND status::text <> 'pago';
    RETURN NEW;
  END IF;

  -- Recalcula apenas o que ainda não foi pago, preservando histórico quitado.
  DELETE FROM public.commission_splits
   WHERE sale_id = NEW.id
     AND status::text <> 'pago';

  -- Base do parceiro:
  --   cascata: bruto menos TODAS as deduções (custos Zenon + prestador)
  --   legado : regra antiga, bruto menos custo Zenon (vendas anteriores à cascata)
  v_partner_base := GREATEST(
    COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0)
    - CASE WHEN NEW.deduction_model = 'cascata' THEN COALESCE(NEW.provider_cost,0) ELSE 0 END,
    0);
  v_partner_amount  := (v_partner_base * COALESCE(NEW.commission_percent, 0)) / 100;
  -- Cascata: indicador e colaborador também calculam sobre a base líquida.
  -- Legado: sobre o bruto, como as vendas antigas foram fechadas.
  v_referrer_amount := ((CASE WHEN NEW.deduction_model = 'cascata' THEN v_partner_base ELSE NEW.amount END) * COALESCE(NEW.referrer_percent, 0)) / 100;
  v_collab_amount   := ((CASE WHEN NEW.deduction_model = 'cascata' THEN v_partner_base ELSE NEW.amount END) * COALESCE(NEW.collaborator_percent, 0)) / 100;
  v_provider_amount := COALESCE(NEW.provider_cost, 0);

  IF NEW.partner_id IS NOT NULL AND v_partner_amount > 0 THEN
    INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
    VALUES (NEW.id, 'partner', NEW.partner_id, v_partner_amount, NEW.commission_percent);
  END IF;

  IF NEW.referrer_id IS NOT NULL AND v_referrer_amount > 0 THEN
    INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
    VALUES (NEW.id, 'referrer', NEW.referrer_id, v_referrer_amount, NEW.referrer_percent);
  END IF;

  IF NEW.collaborator_id IS NOT NULL AND v_collab_amount > 0 THEN
    INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
    VALUES (NEW.id, 'collaborator', NEW.collaborator_id, v_collab_amount, NEW.collaborator_percent);
  END IF;

  IF NEW.service_provider_id IS NOT NULL AND v_provider_amount > 0 THEN
    INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
    VALUES (NEW.id, 'service_provider', NEW.service_provider_id, v_provider_amount, 0);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_base numeric(12,2);
BEGIN
  -- Negociação/proposta não gera pendência financeira de comissão.
  IF NEW.status::text <> 'concluida' THEN
    UPDATE public.commissions
       SET status = 'cancelado',
           workflow_status = 'cancelada',
           paid_at = NULL,
           payment_date = NULL,
           approval_date = NULL,
           updated_at = now()
     WHERE sale_id = NEW.id
       AND COALESCE(status::text, '') NOT IN ('pago','paga');
    RETURN NEW;
  END IF;

  -- Evita duplicidade quando a venda é editada depois de finalizada.
  DELETE FROM public.commissions
   WHERE sale_id = NEW.id
     AND COALESCE(status::text, '') NOT IN ('pago','paga');

  -- Base do parceiro:
  --   cascata: bruto menos TODAS as deduções (custos Zenon + prestador)
  --   legado : regra antiga, bruto menos custo Zenon (vendas anteriores à cascata)
  v_partner_base := GREATEST(
    COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0)
    - CASE WHEN NEW.deduction_model = 'cascata' THEN COALESCE(NEW.provider_cost,0) ELSE 0 END,
    0);

  IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent, 0) > 0 THEN
    INSERT INTO public.commissions (partner_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.partner_id, NEW.id, NEW.client_id, NEW.product_id, ROUND((v_partner_base * NEW.commission_percent)/100,2), NEW.commission_percent, v_partner_base, 'pendente','aguardando_confirmacao','Comissão de Parceiro gerada via venda '||NEW.id,'percentual');
  END IF;

  IF NEW.referrer_id IS NOT NULL AND COALESCE(NEW.referrer_percent, 0) > 0 THEN
    INSERT INTO public.commissions (referrer_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.referrer_id, NEW.id, NEW.client_id, NEW.product_id, ROUND(((CASE WHEN NEW.deduction_model = 'cascata' THEN v_partner_base ELSE NEW.amount END) * NEW.referrer_percent)/100,2), NEW.referrer_percent, (CASE WHEN NEW.deduction_model = 'cascata' THEN v_partner_base ELSE NEW.amount END), 'pendente','aguardando_confirmacao','Comissão de Indicador gerada via venda '||NEW.id,'percentual');
  END IF;

  IF NEW.collaborator_id IS NOT NULL AND COALESCE(NEW.collaborator_percent, 0) > 0 THEN
    INSERT INTO public.commissions (collaborator_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.collaborator_id, NEW.id, NEW.client_id, NEW.product_id, ROUND(((CASE WHEN NEW.deduction_model = 'cascata' THEN v_partner_base ELSE NEW.amount END) * NEW.collaborator_percent)/100,2), NEW.collaborator_percent, (CASE WHEN NEW.deduction_model = 'cascata' THEN v_partner_base ELSE NEW.amount END), 'pendente','aguardando_confirmacao','Comissão de Colaborador gerada via venda '||NEW.id,'percentual');
  END IF;

  IF NEW.service_provider_id IS NOT NULL AND COALESCE(NEW.provider_cost, 0) > 0 THEN
    INSERT INTO public.commissions (service_provider_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.service_provider_id, NEW.id, NEW.client_id, NEW.product_id, ROUND(NEW.provider_cost,2), 0, NEW.amount, 'pendente','aguardando_confirmacao','Repasse ao Prestador gerado via venda '||NEW.id,'fixo');
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- 2) Liberação proporcional
--    liberado = comissão × recebido ÷ valor da venda
--    (recorrente: limite de comissão × meses do contrato)
--    Quando 100% liberado, fica "pago" automaticamente, como antes.
--    Pagamento manual feito pelo admin nunca é desfeito, exceto quando
--    o cliente estorna/desfaz um pagamento (como já acontecia).
-- ---------------------------------------------------------------------
ALTER TABLE public.commission_splits ADD COLUMN IF NOT EXISTS released_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.commissions       ADD COLUMN IF NOT EXISTS released_amount numeric NOT NULL DEFAULT 0;

-- Recebido do cliente numa venda (mesma regra de src/lib/financial.ts)
CREATE OR REPLACE FUNCTION private.sale_received(p_sale_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
           CASE
             WHEN p.status::text IN ('cancelado','cancelada','reembolsado','estornado') THEN 0
             WHEN p.paid_at IS NOT NULL AND (p.paid_at AT TIME ZONE 'America/Sao_Paulo')::date > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 0
             WHEN COALESCE(p.amount_paid, 0) > 0 THEN p.amount_paid
             WHEN p.status::text IN ('pago','paga') THEN p.amount
             ELSE 0
           END), 0)
    FROM public.payments p
   WHERE p.sale_id = p_sale_id;
$$;
REVOKE ALL ON FUNCTION private.sale_received(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.recompute_sale_release(p_sale_id uuid, p_reverted boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s          record;
  v_received numeric;
  v_months   numeric;
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;
  SELECT id, amount, status::text AS status, revenue_type, recurrence_months INTO s FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_received := CASE WHEN s.status = 'concluida' AND COALESCE(s.amount, 0) > 0 THEN private.sale_received(s.id) ELSE 0 END;
  v_months   := CASE WHEN s.revenue_type = 'recorrente' THEN GREATEST(COALESCE(s.recurrence_months, 1), 1) ELSE 1 END;

  -- Repasses (commission_splits)
  UPDATE public.commission_splits cs
     SET released_amount = x.rel,
         status = CASE
                    WHEN cs.status::text = 'pendente' AND x.rel >= x.cap AND x.cap > 0 THEN 'pago'::split_status
                    WHEN p_reverted AND cs.status::text = 'pago' AND x.rel < x.cap THEN 'pendente'::split_status
                    ELSE cs.status END,
         paid_at = CASE
                    WHEN cs.status::text = 'pendente' AND x.rel >= x.cap AND x.cap > 0 THEN COALESCE(cs.paid_at, now())
                    WHEN p_reverted AND cs.status::text = 'pago' AND x.rel < x.cap THEN NULL
                    ELSE cs.paid_at END,
         updated_at = now()
    FROM (
      SELECT c.id,
             round(COALESCE(c.amount, 0) * v_months, 2) AS cap,
             LEAST(round(COALESCE(c.amount, 0) * v_months, 2),
                   round(COALESCE(c.amount, 0) * v_received / NULLIF(s.amount, 0), 2)) AS rel
        FROM public.commission_splits c
       WHERE c.sale_id = s.id AND c.status::text <> 'cancelado'
    ) x
   WHERE cs.id = x.id
     AND (cs.released_amount IS DISTINCT FROM x.rel
          OR (cs.status::text = 'pendente' AND x.rel >= x.cap AND x.cap > 0)
          OR (p_reverted AND cs.status::text = 'pago' AND x.rel < x.cap));

  -- Comissões (commissions)
  UPDATE public.commissions cm
     SET released_amount = x.rel,
         status = CASE
                    WHEN cm.status::text NOT IN ('pago','paga','cancelado','cancelada') AND x.rel >= x.cap AND x.cap > 0 THEN 'pago'
                    WHEN p_reverted AND cm.status::text IN ('pago','paga') AND x.rel < x.cap THEN 'pendente'
                    ELSE cm.status END,
         workflow_status = CASE
                    WHEN cm.status::text NOT IN ('pago','paga','cancelado','cancelada') AND x.rel >= x.cap AND x.cap > 0 THEN 'liberada'
                    WHEN p_reverted AND cm.status::text IN ('pago','paga') AND x.rel < x.cap THEN 'aguardando_confirmacao'
                    ELSE cm.workflow_status END,
         paid_at = CASE WHEN p_reverted AND cm.status::text IN ('pago','paga') AND x.rel < x.cap THEN NULL ELSE cm.paid_at END,
         payment_date = CASE WHEN p_reverted AND cm.status::text IN ('pago','paga') AND x.rel < x.cap THEN NULL ELSE cm.payment_date END,
         updated_at = now()
    FROM (
      SELECT c.id,
             round(COALESCE(c.amount, 0) * v_months, 2) AS cap,
             LEAST(round(COALESCE(c.amount, 0) * v_months, 2),
                   round(COALESCE(c.amount, 0) * v_received / NULLIF(s.amount, 0), 2)) AS rel
        FROM public.commissions c
       WHERE c.sale_id = s.id AND COALESCE(c.status::text, '') NOT IN ('cancelado','cancelada')
         AND c.payment_id IS NULL
    ) x
   WHERE cm.id = x.id
     AND (cm.released_amount IS DISTINCT FROM x.rel
          OR (cm.status::text NOT IN ('pago','paga','cancelado','cancelada') AND x.rel >= x.cap AND x.cap > 0)
          OR (p_reverted AND cm.status::text IN ('pago','paga') AND x.rel < x.cap));
END;
$$;
REVOKE ALL ON FUNCTION private.recompute_sale_release(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- Pagamento do cliente mudou => recalcula o liberado da venda
CREATE OR REPLACE FUNCTION public.maybe_release_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale uuid := COALESCE(NEW.sale_id, OLD.sale_id);
  v_reverted boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_reverted := true;
  ELSIF TG_OP = 'UPDATE' THEN
    v_reverted := (OLD.status::text IN ('pago','paga') AND NEW.status::text NOT IN ('pago','paga'))
               OR COALESCE(NEW.amount_paid, 0) < COALESCE(OLD.amount_paid, 0);
    IF OLD.sale_id IS DISTINCT FROM NEW.sale_id AND OLD.sale_id IS NOT NULL THEN
      PERFORM private.recompute_sale_release(OLD.sale_id, true);
    END IF;
  END IF;
  PERFORM private.recompute_sale_release(v_sale, v_reverted);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_release_commission ON public.payments;
CREATE TRIGGER trg_payments_release_commission
  AFTER INSERT OR UPDATE OF status, amount, amount_paid, paid_at, sale_id OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.maybe_release_commission();

-- Comissões recalculadas na venda (valor, %, deduções) => recalcula o liberado.
-- Nome garante que roda depois de on_sale_created e on_sale_created_splits.
CREATE OR REPLACE FUNCTION private.sales_recompute_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM private.recompute_sale_release(NEW.id, false);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.sales_recompute_release() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_sale_zz_recompute_release ON public.sales;
CREATE TRIGGER on_sale_zz_recompute_release
  AFTER INSERT OR UPDATE OF status, amount, zenon_cost, provider_cost, partner_id, referrer_id, collaborator_id,
    service_provider_id, commission_percent, referrer_percent, collaborator_percent, revenue_type, recurrence_months
  ON public.sales
  FOR EACH ROW EXECUTE FUNCTION private.sales_recompute_release();

-- Fim da comissão em dobro: a comissão da venda inteira já é gerada ao
-- concluir (handle_new_sale). A geração por parcela duplicava.
DROP TRIGGER IF EXISTS payments_sync_commissions ON public.payments;

-- Cancela as duplicadas que ainda não foram pagas: comissão por parcela
-- quando já existe a comissão da venda para o mesmo beneficiário.
UPDATE public.commissions dup
   SET status = 'cancelado', workflow_status = 'cancelada',
       notes = COALESCE(dup.notes || ' | ', '') || 'Cancelada: duplicava a comissão da venda',
       updated_at = now()
 WHERE dup.payment_id IS NOT NULL
   AND COALESCE(dup.status::text, '') NOT IN ('pago','paga','cancelado','cancelada')
   AND EXISTS (
     SELECT 1 FROM public.commissions base
      WHERE base.sale_id = dup.sale_id
        AND base.payment_id IS NULL
        AND COALESCE(base.status::text, '') NOT IN ('cancelado','cancelada')
        AND base.partner_id          IS NOT DISTINCT FROM dup.partner_id
        AND base.referrer_id         IS NOT DISTINCT FROM dup.referrer_id
        AND base.collaborator_id     IS NOT DISTINCT FROM dup.collaborator_id
        AND base.service_provider_id IS NOT DISTINCT FROM dup.service_provider_id);

-- Preenche o liberado das vendas existentes (sem notificar ninguém)
ALTER TABLE public.commission_splits DISABLE TRIGGER USER;
ALTER TABLE public.commissions       DISABLE TRIGGER USER;
SELECT private.recompute_sale_release(id, false) FROM public.sales WHERE status::text = 'concluida';
ALTER TABLE public.commission_splits ENABLE TRIGGER USER;
ALTER TABLE public.commissions       ENABLE TRIGGER USER;

-- ---------------------------------------------------------------------
-- 3) Provisões viram contas a pagar
--    Venda concluída (modelo cascata): cada dedução vira uma despesa por
--    parcela do cliente, na competência da parcela. Prestador fica de
--    fora (é pago pelo repasse) e "Custo Zenon" também (custo legado).
--    Despesa já paga nunca é apagada nem refeita.
-- ---------------------------------------------------------------------
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS sale_deduction_id uuid REFERENCES public.sale_deductions(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS auto_provision boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS expenses_sale_id_idx ON public.expenses(sale_id) WHERE sale_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.regenerate_sale_provisions(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.expenses
   WHERE sale_id = p_sale_id AND auto_provision AND NOT COALESCE(paid, false);

  SELECT sl.id, sl.amount, sl.status::text AS status, sl.deduction_model, c.full_name AS client_name
    INTO s
    FROM public.sales sl LEFT JOIN public.clients c ON c.id = sl.client_id
   WHERE sl.id = p_sale_id;
  IF NOT FOUND OR s.status <> 'concluida' OR s.deduction_model <> 'cascata' OR COALESCE(s.amount, 0) <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.expenses
    (description, category, subcategory, amount, expense_date, due_date, reference_month, paid,
     notes, sale_id, sale_deduction_id, payment_id, auto_provision)
  SELECT
    t.name || ' · ' || COALESCE(s.client_name, 'Cliente')
      || CASE WHEN COALESCE(p.installments_count, 1) > 1
              THEN ' · parcela ' || COALESCE(p.installment_number::text, '?') || '/' || p.installments_count
              ELSE '' END,
    'Provisão de venda',
    t.name,
    round(COALESCE(d.fixed_amount, round(s.amount * d.percent / 100, 2)) * p.amount / s.amount, 2),
    COALESCE(p.due_date, current_date),
    p.due_date,
    date_trunc('month', COALESCE(p.competence_month::date, p.due_date, current_date))::date,
    false,
    'Gerada automaticamente pela dedução da venda',
    s.id, d.id, p.id, true
  FROM public.sale_deductions d
  JOIN public.deduction_types t ON t.id = d.deduction_type_id
  JOIN public.payments p ON p.sale_id = s.id
                        AND p.status::text NOT IN ('cancelado','cancelada','reembolsado','estornado')
  WHERE d.sale_id = s.id
    AND t.category NOT IN ('prestador','custo_zenon')
    AND NOT EXISTS (  -- já existe provisão paga para esta dedução e parcela
      SELECT 1 FROM public.expenses e
       WHERE e.sale_id = s.id AND e.auto_provision AND COALESCE(e.paid, false)
         AND e.sale_deduction_id = d.id AND e.payment_id = p.id)
    AND round(COALESCE(d.fixed_amount, round(s.amount * d.percent / 100, 2)) * p.amount / s.amount, 2) > 0;
END;
$$;
REVOKE ALL ON FUNCTION private.regenerate_sale_provisions(uuid) FROM PUBLIC, anon, authenticated;

-- Gatilhos: parcelas, deduções e status/valor da venda
CREATE OR REPLACE FUNCTION private.provisions_from_changed_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT sale_id FROM changed_rows WHERE sale_id IS NOT NULL LOOP
    PERFORM private.regenerate_sale_provisions(r.sale_id);
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.provisions_from_changed_rows() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_payments_provisions_ins ON public.payments;
CREATE TRIGGER trg_payments_provisions_ins AFTER INSERT ON public.payments
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION private.provisions_from_changed_rows();
DROP TRIGGER IF EXISTS trg_payments_provisions_upd ON public.payments;
CREATE TRIGGER trg_payments_provisions_upd AFTER UPDATE ON public.payments
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION private.provisions_from_changed_rows();
DROP TRIGGER IF EXISTS trg_payments_provisions_del ON public.payments;
CREATE TRIGGER trg_payments_provisions_del AFTER DELETE ON public.payments
  REFERENCING OLD TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION private.provisions_from_changed_rows();

DROP TRIGGER IF EXISTS trg_sale_deductions_provisions_ins ON public.sale_deductions;
CREATE TRIGGER trg_sale_deductions_provisions_ins AFTER INSERT ON public.sale_deductions
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION private.provisions_from_changed_rows();
DROP TRIGGER IF EXISTS trg_sale_deductions_provisions_upd ON public.sale_deductions;
CREATE TRIGGER trg_sale_deductions_provisions_upd AFTER UPDATE ON public.sale_deductions
  REFERENCING NEW TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION private.provisions_from_changed_rows();
DROP TRIGGER IF EXISTS trg_sale_deductions_provisions_del ON public.sale_deductions;
CREATE TRIGGER trg_sale_deductions_provisions_del AFTER DELETE ON public.sale_deductions
  REFERENCING OLD TABLE AS changed_rows FOR EACH STATEMENT EXECUTE FUNCTION private.provisions_from_changed_rows();

CREATE OR REPLACE FUNCTION private.sales_regenerate_provisions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM private.regenerate_sale_provisions(NEW.id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.sales_regenerate_provisions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sales_regenerate_provisions ON public.sales;
CREATE TRIGGER trg_sales_regenerate_provisions
  AFTER UPDATE OF status, amount, deduction_model ON public.sales
  FOR EACH ROW EXECUTE FUNCTION private.sales_regenerate_provisions();

-- Vendas na cascata já concluídas: gera as provisões
SELECT private.regenerate_sale_provisions(id)
  FROM public.sales WHERE status::text = 'concluida' AND deduction_model = 'cascata';

-- ---------------------------------------------------------------------
-- 4) Extrato: valor liberado e base líquida também para o indicador
-- ---------------------------------------------------------------------
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
  released_amount    numeric,
  base_calculo       numeric,
  revenue_type       text,
  recurrence_months  integer,
  gross_amount       numeric,
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
    cs.released_amount,
    -- base líquida: parceiro sempre; indicador só em vendas na cascata
    -- (no legado a base do indicador era o bruto, que não pode vazar)
    CASE
      WHEN COALESCE(cs.percent, 0) > 0
       AND (cs.beneficiary_type = 'partner'
            OR (cs.beneficiary_type = 'referrer' AND s.deduction_model = 'cascata'))
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
