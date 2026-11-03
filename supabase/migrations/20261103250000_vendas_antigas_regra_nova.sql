-- =====================================================================
-- Vendas antigas passam para a regra nova
-- ---------------------------------------------------------------------
-- Decisões do admin:
--  1) Só vendas NÃO quitadas (projetadas, ou concluídas com parcela,
--     comissão ou repasse em aberto). As encerradas ficam como estão.
--  2) O admin preenche as deduções de cada uma. Até salvar a revisão, a
--     venda continua com a regra antiga (nada muda pela metade).
--  3) O que já foi pago fica pago; a regra nova vale só para o que falta.
--  4) Contas a pagar das provisões só das parcelas em aberto na conversão.
-- Também corrige: editar uma venda com comissão já paga recriava a
-- comissão inteira (pagamento em dobro).
-- =====================================================================

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS deduction_review_pending boolean NOT NULL DEFAULT false;
-- Data a partir da qual a venda entrou na cascata (NULL = desde sempre)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cascata_since timestamptz;

-- 1) Marca as vendas antigas não quitadas para revisão (sem disparar gatilhos)
ALTER TABLE public.sales DISABLE TRIGGER USER;
UPDATE public.sales s
   SET deduction_review_pending = true
 WHERE s.deduction_model = 'legado'
   AND s.status::text <> 'cancelada'
   AND (
         s.status::text IN ('pendente','em_andamento')
      OR EXISTS (SELECT 1 FROM public.payments p
                  WHERE p.sale_id = s.id
                    AND p.status::text NOT IN ('pago','paga','cancelado','cancelada','reembolsado','estornado'))
      OR EXISTS (SELECT 1 FROM public.commission_splits cs
                  WHERE cs.sale_id = s.id AND cs.status::text = 'pendente')
      OR EXISTS (SELECT 1 FROM public.commissions cm
                  WHERE cm.sale_id = s.id
                    AND COALESCE(cm.status::text, '') NOT IN ('pago','paga','cancelado','cancelada'))
   );
ALTER TABLE public.sales ENABLE TRIGGER USER;

-- 2) Quanto já foi pago a um beneficiário numa venda
CREATE OR REPLACE FUNCTION private.paid_split_total(p_sale_id uuid, p_type text, p_beneficiary uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
    FROM public.commission_splits
   WHERE sale_id = p_sale_id
     AND beneficiary_type::text = p_type
     AND beneficiary_id = p_beneficiary
     AND status::text = 'pago';
$$;
REVOKE ALL ON FUNCTION private.paid_split_total(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

-- 3) Repasses e comissões descontam o que já foi pago
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

  -- O que já foi pago a cada beneficiário fica pago; a regra vale só para o que falta.
  -- (Antes, editar uma venda com repasse já pago recriava o repasse inteiro.)
  v_partner_amount  := GREATEST(v_partner_amount  - private.paid_split_total(NEW.id, 'partner',          NEW.partner_id), 0);
  v_referrer_amount := GREATEST(v_referrer_amount - private.paid_split_total(NEW.id, 'referrer',         NEW.referrer_id), 0);
  v_collab_amount   := GREATEST(v_collab_amount   - private.paid_split_total(NEW.id, 'collaborator',     NEW.collaborator_id), 0);
  v_provider_amount := GREATEST(v_provider_amount - private.paid_split_total(NEW.id, 'service_provider', NEW.service_provider_id), 0);

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

  -- O que já foi pago a cada beneficiário fica pago; a regra vale só para o que falta.
  UPDATE public.commissions c
     SET amount = GREATEST(c.amount - x.paid, 0)
    FROM (
      SELECT n.id,
             (SELECT COALESCE(SUM(p.amount), 0)
                FROM public.commissions p
               WHERE p.sale_id = NEW.id
                 AND p.status::text IN ('pago','paga')
                 AND p.partner_id          IS NOT DISTINCT FROM n.partner_id
                 AND p.referrer_id         IS NOT DISTINCT FROM n.referrer_id
                 AND p.collaborator_id     IS NOT DISTINCT FROM n.collaborator_id
                 AND p.service_provider_id IS NOT DISTINCT FROM n.service_provider_id) AS paid
        FROM public.commissions n
       WHERE n.sale_id = NEW.id
         AND COALESCE(n.status::text, '') NOT IN ('pago','paga','cancelado','cancelada')
    ) x
   WHERE c.id = x.id AND x.paid > 0;

  DELETE FROM public.commissions
   WHERE sale_id = NEW.id
     AND COALESCE(status::text, '') NOT IN ('pago','paga','cancelado','cancelada')
     AND COALESCE(amount, 0) <= 0;

  RETURN NEW;
END;
$function$;

-- 4) Liberação proporcional considerando o que já foi pago:
--    liberado do saldo = (pago + saldo) × recebido ÷ valor − pago
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
  -- sales.amount é o valor TOTAL do contrato (inclusive recorrente: o formulário
  -- divide o total pelos meses nas mensalidades). Comissão também é sobre o total.
  v_months   := 1;

  -- Repasses: linhas pagas ficam com liberado = valor; saldo em aberto proporcional
  UPDATE public.commission_splits cs
     SET released_amount = x.rel,
         status = CASE
                    WHEN cs.status::text = 'pendente' AND x.rel >= x.cap AND x.cap > 0 THEN 'pago'::split_status
                    WHEN p_reverted AND cs.status::text = 'pago' AND NOT x.was_paid_row AND x.rel < x.cap THEN 'pendente'::split_status
                    ELSE cs.status END,
         paid_at = CASE
                    WHEN cs.status::text = 'pendente' AND x.rel >= x.cap AND x.cap > 0 THEN COALESCE(cs.paid_at, now())
                    WHEN p_reverted AND cs.status::text = 'pago' AND NOT x.was_paid_row AND x.rel < x.cap THEN NULL
                    ELSE cs.paid_at END,
         updated_at = now()
    FROM (
      SELECT c.id,
             false AS was_paid_row,
             round(COALESCE(c.amount, 0) * v_months, 2) AS cap,
             LEAST(round(COALESCE(c.amount, 0) * v_months, 2),
                   GREATEST(0, round((COALESCE(c.amount, 0) + pd.paid) * v_received / NULLIF(s.amount, 0), 2) - pd.paid)) AS rel
        FROM public.commission_splits c
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(o.amount), 0) AS paid
            FROM public.commission_splits o
           WHERE o.sale_id = c.sale_id AND o.id <> c.id
             AND o.beneficiary_type = c.beneficiary_type AND o.beneficiary_id = c.beneficiary_id
             AND o.status::text = 'pago'
        ) pd
       WHERE c.sale_id = s.id AND c.status::text <> 'cancelado'
    ) x
   WHERE cs.id = x.id
     AND (cs.released_amount IS DISTINCT FROM x.rel
          OR (cs.status::text = 'pendente' AND x.rel >= x.cap AND x.cap > 0)
          OR (p_reverted AND cs.status::text = 'pago' AND x.rel < x.cap));

  -- Comissões (tabela commissions), mesma regra
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
                   GREATEST(0, round((COALESCE(c.amount, 0) + pd.paid) * v_received / NULLIF(s.amount, 0), 2) - pd.paid)) AS rel
        FROM public.commissions c
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(o.amount), 0) AS paid
            FROM public.commissions o
           WHERE o.sale_id = c.sale_id AND o.id <> c.id
             AND o.status::text IN ('pago','paga')
             AND o.partner_id          IS NOT DISTINCT FROM c.partner_id
             AND o.referrer_id         IS NOT DISTINCT FROM c.referrer_id
             AND o.collaborator_id     IS NOT DISTINCT FROM c.collaborator_id
             AND o.service_provider_id IS NOT DISTINCT FROM c.service_provider_id
        ) pd
       WHERE c.sale_id = s.id AND COALESCE(c.status::text, '') NOT IN ('cancelado','cancelada')
         AND c.payment_id IS NULL
         AND COALESCE(c.status::text, '') NOT IN ('pago','paga')
    ) x
   WHERE cm.id = x.id
     AND (cm.released_amount IS DISTINCT FROM x.rel
          OR (cm.status::text NOT IN ('pago','paga','cancelado','cancelada') AND x.rel >= x.cap AND x.cap > 0));
END;
$$;
REVOKE ALL ON FUNCTION private.recompute_sale_release(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- 5) Provisões: venda convertida só gera das parcelas em aberto na conversão
CREATE OR REPLACE FUNCTION private.regenerate_sale_provisions(p_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record;
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.expenses
   WHERE sale_id = p_sale_id AND auto_provision AND NOT COALESCE(paid, false);

  SELECT sl.id, sl.amount, sl.status::text AS status, sl.deduction_model, sl.cascata_since, c.full_name AS client_name
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
                        -- venda antiga convertida: só parcelas em aberto na data da conversão
                        AND (s.cascata_since IS NULL OR p.paid_at IS NULL OR p.paid_at >= s.cascata_since)
  WHERE d.sale_id = s.id
    AND t.category NOT IN ('prestador','custo_zenon')
    AND NOT EXISTS (  -- já existe provisão paga para esta dedução e parcela
      SELECT 1 FROM public.expenses e
       WHERE e.sale_id = s.id AND e.auto_provision AND COALESCE(e.paid, false)
         AND e.sale_deduction_id = d.id AND e.payment_id = p.id)
    AND round(COALESCE(d.fixed_amount, round(s.amount * d.percent / 100, 2)) * p.amount / s.amount, 2) > 0;
END;
$function$;

-- 6) Ao salvar a revisão de uma venda antiga (deduction_model passa a
--    'cascata'), grava a data da conversão e tira a pendência.
CREATE OR REPLACE FUNCTION private.sales_mark_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deduction_model = 'legado' AND NEW.deduction_model = 'cascata' THEN
    NEW.cascata_since := COALESCE(NEW.cascata_since, now());
    NEW.deduction_review_pending := false;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sales_mark_conversion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sales_mark_conversion ON public.sales;
CREATE TRIGGER trg_sales_mark_conversion
  BEFORE UPDATE OF deduction_model ON public.sales
  FOR EACH ROW EXECUTE FUNCTION private.sales_mark_conversion();

-- 7) Trocar o modelo de cálculo também recalcula comissões, repasses e liberado
DROP TRIGGER IF EXISTS on_sale_created ON public.sales;
CREATE TRIGGER on_sale_created
AFTER INSERT OR UPDATE OF status, amount, zenon_cost, provider_cost, partner_id, referrer_id, collaborator_id, service_provider_id, commission_percent, referrer_percent, collaborator_percent, deduction_model
ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_new_sale();

DROP TRIGGER IF EXISTS on_sale_created_splits ON public.sales;
CREATE TRIGGER on_sale_created_splits
AFTER INSERT OR UPDATE OF status, amount, zenon_cost, provider_cost, partner_id, referrer_id, collaborator_id, service_provider_id, commission_percent, referrer_percent, collaborator_percent, deduction_model
ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_splits();

DROP TRIGGER IF EXISTS on_sale_zz_recompute_release ON public.sales;
CREATE TRIGGER on_sale_zz_recompute_release
  AFTER INSERT OR UPDATE OF status, amount, zenon_cost, provider_cost, partner_id, referrer_id, collaborator_id,
    service_provider_id, commission_percent, referrer_percent, collaborator_percent, revenue_type, recurrence_months, deduction_model
  ON public.sales
  FOR EACH ROW EXECUTE FUNCTION private.sales_recompute_release();

-- 8) Quem já recebeu mais do que a regra nova daria (só admin enxerga:
--    a view respeita o RLS das tabelas, que são só do admin)
CREATE OR REPLACE VIEW public.v_commission_overpayments
WITH (security_invoker = true) AS
WITH due AS (
  SELECT s.id AS sale_id, s.client_id,
         GREATEST(COALESCE(s.amount,0) - COALESCE(s.zenon_cost,0) - COALESCE(s.provider_cost,0), 0) AS base,
         s.partner_id, s.commission_percent, s.referrer_id, s.referrer_percent,
         s.collaborator_id, s.collaborator_percent
    FROM public.sales s
   WHERE s.deduction_model = 'cascata' AND s.status::text <> 'cancelada'
), rows AS (
  SELECT sale_id, client_id, 'partner'::text AS beneficiary_type, partner_id AS beneficiary_id,
         round(base * COALESCE(commission_percent,0) / 100, 2) AS due_amount FROM due WHERE partner_id IS NOT NULL
  UNION ALL
  SELECT sale_id, client_id, 'referrer', referrer_id,
         round(base * COALESCE(referrer_percent,0) / 100, 2) FROM due WHERE referrer_id IS NOT NULL
  UNION ALL
  SELECT sale_id, client_id, 'collaborator', collaborator_id,
         round(base * COALESCE(collaborator_percent,0) / 100, 2) FROM due WHERE collaborator_id IS NOT NULL
)
SELECT r.sale_id, r.client_id, c.full_name AS client_name, r.beneficiary_type, r.beneficiary_id,
       COALESCE(p.full_name, rf.full_name) AS beneficiary_name,
       r.due_amount, pd.paid_amount, pd.paid_amount - r.due_amount AS overpaid
  FROM rows r
  JOIN LATERAL (
    SELECT COALESCE(SUM(cs.amount), 0) AS paid_amount
      FROM public.commission_splits cs
     WHERE cs.sale_id = r.sale_id AND cs.beneficiary_type::text = r.beneficiary_type
       AND cs.beneficiary_id = r.beneficiary_id AND cs.status::text = 'pago'
  ) pd ON true
  LEFT JOIN public.clients c    ON c.id = r.client_id
  LEFT JOIN public.partners p   ON r.beneficiary_type = 'partner'  AND p.id = r.beneficiary_id
  LEFT JOIN public.referrers rf ON r.beneficiary_type = 'referrer' AND rf.id = r.beneficiary_id
 WHERE pd.paid_amount > r.due_amount + 0.01;

REVOKE ALL ON public.v_commission_overpayments FROM anon;
GRANT SELECT ON public.v_commission_overpayments TO authenticated;
