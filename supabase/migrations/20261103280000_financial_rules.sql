-- Caixa por paid_at; venda por sale_date; liberação não é repasse.
-- RLS, extrato restrito, deduções e geração de parcelas permanecem intactos.
-- Não reclassifica pagamentos históricos: pago automático e manual não são
-- distinguíveis com segurança nos dados legados.

CREATE OR REPLACE FUNCTION private.goal_actuals(p_month date, p_stage_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_week  date := date_trunc('week', now())::date;
  v_out   jsonb;
  v_filter boolean := p_stage_ids IS NOT NULL AND array_length(p_stage_ids, 1) > 0;
BEGIN
  WITH sales_m AS (
    SELECT s.id, s.revenue_type
      FROM public.sales s
     WHERE s.status::text = 'concluida'
       AND s.sale_date >= v_start
       AND s.sale_date <  v_end
       AND (NOT v_filter OR s.stage_id_at_sale = ANY (p_stage_ids))
  ),
  rec AS (
    SELECT s.revenue_type,
           CASE
             WHEN p.status::text IN ('cancelado','cancelada','reembolsado','estornado') THEN 0
             WHEN p.paid_at IS NOT NULL AND (p.paid_at AT TIME ZONE 'America/Sao_Paulo')::date > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 0
             WHEN COALESCE(p.amount_paid, 0) > 0 THEN p.amount_paid
             WHEN p.status::text IN ('pago','paga') THEN p.amount
             ELSE 0
           END AS received
      FROM public.payments p
      JOIN public.sales s ON s.id = p.sale_id
     WHERE s.status::text = 'concluida'
       AND (NOT v_filter OR s.stage_id_at_sale = ANY (p_stage_ids))
       AND date_trunc('month', p.paid_at AT TIME ZONE 'America/Sao_Paulo')::date = v_start
  )
  SELECT jsonb_build_object(
    'leads',            (SELECT COUNT(*) FROM public.leads WHERE created_at >= v_start AND created_at < v_end),
    'proposals',        (SELECT COUNT(*) FROM public.proposals WHERE created_at >= v_start AND created_at < v_end),
    'sales_count',      (SELECT COUNT(*) FROM sales_m),
    'revenue',          (SELECT COALESCE(SUM(received), 0) FROM rec),
    'recurring_revenue',(SELECT COALESCE(SUM(received), 0) FROM rec WHERE revenue_type = 'recorrente'),
    'one_time_revenue', (SELECT COALESCE(SUM(received), 0) FROM rec WHERE COALESCE(revenue_type, 'avulso') <> 'recorrente'),
    'stage_movements',  (SELECT COUNT(*) FROM public.client_timeline
                          WHERE event_type = 'journey_stage_change' AND created_at >= v_start AND created_at < v_end),
    'clients_closed',   (SELECT COUNT(*) FROM public.leads WHERE status = 'won' AND updated_at >= v_start AND updated_at < v_end),
    'clientes_fechados',(SELECT COUNT(*) FROM public.clients c JOIN public.client_journey_stages st ON st.id = c.journey_stage_id
                          WHERE st.is_terminal AND c.stage_changed_at >= v_start AND c.stage_changed_at < v_end),
    'captacao_mes',     (SELECT COUNT(*) FROM public.clients c JOIN public.client_journey_stages st ON st.id = c.journey_stage_id
                          WHERE st.is_captation AND c.stage_changed_at >= v_start AND c.stage_changed_at < v_end),
    'captacao_semana',  (SELECT COUNT(*) FROM public.clients c JOIN public.client_journey_stages st ON st.id = c.journey_stage_id
                          WHERE st.is_captation AND c.stage_changed_at >= v_week),
    'captacao_dia',     (SELECT COUNT(*) FROM public.clients c JOIN public.client_journey_stages st ON st.id = c.journey_stage_id
                          WHERE st.is_captation AND c.stage_changed_at >= current_date),
    'stage_counts',     COALESCE((SELECT jsonb_object_agg(journey_stage_id, n) FROM (
                          SELECT journey_stage_id, COUNT(*) n FROM public.clients
                           WHERE journey_stage_id IS NOT NULL GROUP BY 1) x), '{}'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION private.goal_actuals(date, uuid[]) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.trg_recompute_goals_current_month()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_months date[] := ARRAY[date_trunc('month', now())::date];
  m date;
BEGIN
  IF TG_TABLE_NAME = 'sales' THEN
    IF TG_OP <> 'DELETE' THEN
      v_months := v_months || date_trunc('month', NEW.sale_date)::date;
    END IF;
    IF TG_OP <> 'INSERT' THEN
      v_months := v_months || date_trunc('month', OLD.sale_date)::date;
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    IF TG_OP <> 'DELETE' THEN
      v_months := v_months || date_trunc('month', (NEW.paid_at AT TIME ZONE 'America/Sao_Paulo')::date)::date;
    END IF;
    IF TG_OP <> 'INSERT' THEN
      v_months := v_months || date_trunc('month', (OLD.paid_at AT TIME ZONE 'America/Sao_Paulo')::date)::date;
    END IF;
  END IF;

  FOR m IN SELECT DISTINCT x FROM unnest(v_months) x WHERE x IS NOT NULL LOOP
    PERFORM public.recompute_sales_goals_for_month(m);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_goals_on_payment ON public.payments;
CREATE TRIGGER trg_goals_on_payment
  AFTER INSERT OR UPDATE OF status, amount, amount_paid, paid_at, due_date, competence_month OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_goals_current_month();


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

  -- Repasses pagos são preservados integralmente; só recalcula os abertos.
  UPDATE public.commission_splits cs
     SET released_amount = x.rel,
         status = CASE WHEN x.rel >= x.cap AND x.cap > 0 THEN 'liberada'::split_status
                       ELSE 'pendente'::split_status END,
         updated_at = now()
    FROM (
      SELECT c.id,
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
       WHERE c.sale_id = s.id AND c.status::text IN ('pendente', 'liberada')
    ) x
   WHERE cs.id = x.id
     AND (cs.released_amount IS DISTINCT FROM x.rel
          OR cs.status::text IS DISTINCT FROM CASE WHEN x.rel >= x.cap AND x.cap > 0 THEN 'liberada' ELSE 'pendente' END);

  -- Comissões (tabela commissions), mesma regra
  UPDATE public.commissions cm
     SET released_amount = x.rel,
         -- Legacy status remains pending; workflow describes release, never payout.
         workflow_status = CASE WHEN x.rel >= x.cap AND x.cap > 0 THEN 'liberada'
                                ELSE 'aguardando_confirmacao' END,
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
          OR cm.workflow_status IS DISTINCT FROM CASE WHEN x.rel >= x.cap AND x.cap > 0 THEN 'liberada' ELSE 'aguardando_confirmacao' END);
END;
$$;
REVOKE ALL ON FUNCTION private.recompute_sale_release(uuid, boolean) FROM PUBLIC, anon, authenticated;


-- Guarda o cronograma original quando um adiantamento redistribui os valores.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS scheduled_amount_before_advance numeric;
COMMENT ON COLUMN public.payments.scheduled_amount_before_advance IS
  'Valor original da parcela antes do primeiro abatimento por adiantamento. amount é o valor ajustado; amount_paid continua sendo caixa real.';

-- A entrada fica inteira na parcela em que foi registrada (uma data, um caixa).
-- O excedente aumenta a cobertura dessa parcela e reduz os próximos vencimentos.
-- Não inventa recebimentos futuros nem muda a data de parcelas já parcialmente pagas.
-- Ex.: parcelas 1000 + 1000, entrada 1500 => valores ajustados 1500 + 500,
-- amount_paid 1500 + 0. Total contratual e caixa permanecem inalterados.
CREATE OR REPLACE FUNCTION private.apply_payment_advance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_excess numeric;
  v_take numeric;
  v_allocated numeric := 0;
  v_sale_status text;
BEGIN
  IF NEW.sale_id IS NULL THEN RETURN NEW; END IF;
  -- Serializa com a alteração de status da venda. Conflitos de locks abortam
  -- a transação inteira, nunca deixam abatimento aplicado pela metade.
  SELECT status::text INTO v_sale_status FROM public.sales WHERE id = NEW.sale_id FOR UPDATE;
  IF COALESCE(NEW.amount_paid, 0) > 0 AND v_sale_status IN ('pendente','em_andamento') THEN
    RAISE EXCEPTION 'Conclua a venda antes de registrar um recebimento.';
  END IF;
  IF v_sale_status <> 'concluida' OR NEW.status::text IN ('cancelado','cancelada','reembolsado','estornado')
     OR NEW.paid_at IS NULL
     OR (NEW.paid_at AT TIME ZONE 'America/Sao_Paulo')::date > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RETURN NEW;
  END IF;
  v_excess := round(COALESCE(NEW.amount_paid, 0) - COALESCE(NEW.amount, 0), 2);
  IF v_excess <= 0 THEN RETURN NEW; END IF;
  FOR r IN
    SELECT id, amount, COALESCE(amount_paid,0) AS paid
      FROM public.payments
     WHERE sale_id = NEW.sale_id AND id <> NEW.id
       AND status::text IN ('pendente','em_aberto','parcial','parcialmente_pago','atrasado','vencido')
       AND (due_date > NEW.due_date OR (due_date = NEW.due_date AND id > NEW.id))
       AND amount > COALESCE(amount_paid,0)
     ORDER BY due_date, id FOR UPDATE
  LOOP
    EXIT WHEN v_excess <= 0;
    v_take := LEAST(v_excess, r.amount - r.paid);
    UPDATE public.payments SET
      scheduled_amount_before_advance = COALESCE(scheduled_amount_before_advance, amount),
      amount = amount - v_take,
      status = CASE WHEN amount - v_take <= COALESCE(amount_paid,0) THEN 'pago'::payment_status ELSE status END
      WHERE id = r.id;
    v_excess := v_excess - v_take;
    v_allocated := v_allocated + v_take;
  END LOOP;
  IF v_allocated > 0 THEN
    NEW.scheduled_amount_before_advance := COALESCE(NEW.scheduled_amount_before_advance, NEW.amount);
    NEW.amount := NEW.amount + v_allocated;
  END IF;
  -- Excedente acima de todo o contrato permanece como crédito na entrada;
  -- não gera parcela nem aumenta sales.amount.
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.apply_payment_advance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_apply_payment_advance BEFORE INSERT OR UPDATE OF amount_paid, paid_at, status ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.apply_payment_advance();

CREATE OR REPLACE FUNCTION private.prevent_paid_sale_reprojection()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Também cobre concluída -> cancelada -> projetada, impedindo contorno.
  IF NEW.status::text IN ('pendente','em_andamento') AND OLD.status IS DISTINCT FROM NEW.status
     AND EXISTS (SELECT 1 FROM public.payments p WHERE p.sale_id = NEW.id
                 AND (COALESCE(p.amount_paid,0) > 0 OR
                      (p.status::text IN ('pago','paga') AND COALESCE(p.amount,0) > 0))) THEN
    RAISE EXCEPTION 'Não é possível voltar para projetada: esta venda já possui valor pago.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.prevent_paid_sale_reprojection() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_prevent_paid_sale_reprojection BEFORE UPDATE OF status ON public.sales
FOR EACH ROW EXECUTE FUNCTION private.prevent_paid_sale_reprojection();

-- Atualiza só saldos ainda em aberto. Nenhum histórico pago é reclassificado.
SELECT private.recompute_sale_release(id, false) FROM public.sales WHERE status::text = 'concluida';
SELECT public.recompute_sales_goals_for_month(m)
FROM (SELECT DISTINCT period_month AS m FROM public.sales_goals) months;

-- Mesmo cuidado para cobrança avulsa, preservando a consulta ao cofre do PR #11.
CREATE OR REPLACE FUNCTION public.sync_splits_for_payment(p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  v_client_partner uuid;
  v_client_referrer uuid;
  v_client_collab uuid;
  v_partner_pct numeric := 0;
  v_collab_pct numeric := 0;
  v_ref_pct numeric := 0;
  v_partner_id uuid;
  v_referrer_id uuid;
  v_collab_id uuid;
  base numeric;
  amt numeric;
  new_status split_status;
  pay_at timestamptz;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- If linked to a sale, the sale-based flow (handle_sale_splits + maybe_release_commission) owns it.
  IF p.sale_id IS NOT NULL THEN RETURN; END IF;

  SELECT partner_id, referrer_id, collaborator_id
    INTO v_client_partner, v_client_referrer, v_client_collab
    FROM public.clients WHERE id = p.client_id;

  IF p.client_product_id IS NOT NULL THEN
    SELECT COALESCE(partner_commission,0), COALESCE(employee_commission,0)
      INTO v_partner_pct, v_collab_pct
      FROM public.client_product_financials WHERE client_product_id = p.client_product_id;
  END IF;

  v_partner_id  := COALESCE(p.partner_id,  v_client_partner);
  v_referrer_id := COALESCE(p.referrer_id, v_client_referrer);
  v_collab_id   := COALESCE(p.collaborator_id, v_client_collab);

  IF v_referrer_id IS NOT NULL THEN
    SELECT COALESCE(commission_percent, 0) INTO v_ref_pct
      FROM public.referrers WHERE id = v_referrer_id;
  END IF;

  base := COALESCE(p.amount, 0);
  IF base <= 0 THEN RETURN; END IF;

  IF p.status::text IN ('cancelado','cancelada','estornado','reembolsado') THEN
    UPDATE public.commission_splits
       SET status = 'cancelado'::split_status, updated_at = now()
     WHERE payment_id = p_payment_id AND status::text <> 'pago';
    RETURN;
  END IF;

  DELETE FROM public.commission_splits
   WHERE payment_id = p_payment_id AND status::text <> 'pago';

  IF p.status::text IN ('pago','paga') THEN
    new_status := 'liberada'::split_status;
    pay_at := NULL;
  ELSE
    new_status := 'pendente'::split_status;
    pay_at := NULL;
  END IF;

  IF v_partner_id IS NOT NULL AND v_partner_pct > 0 THEN
    amt := round(base * (v_partner_pct / 100.0), 2);
    IF amt > 0 THEN
      INSERT INTO public.commission_splits
        (sale_id, payment_id, client_id, client_product_id, beneficiary_type, beneficiary_id, amount, percent, status, paid_at)
      VALUES (NULL, p_payment_id, p.client_id, p.client_product_id, 'partner', v_partner_id, amt, v_partner_pct, new_status, pay_at);
    END IF;
  END IF;

  IF v_referrer_id IS NOT NULL AND v_ref_pct > 0 THEN
    amt := round(base * (v_ref_pct / 100.0), 2);
    IF amt > 0 THEN
      INSERT INTO public.commission_splits
        (sale_id, payment_id, client_id, client_product_id, beneficiary_type, beneficiary_id, amount, percent, status, paid_at)
      VALUES (NULL, p_payment_id, p.client_id, p.client_product_id, 'referrer', v_referrer_id, amt, v_ref_pct, new_status, pay_at);
    END IF;
  END IF;

  IF v_collab_id IS NOT NULL AND v_collab_pct > 0 THEN
    amt := round(base * (v_collab_pct / 100.0), 2);
    IF amt > 0 THEN
      INSERT INTO public.commission_splits
        (sale_id, payment_id, client_id, client_product_id, beneficiary_type, beneficiary_id, amount, percent, status, paid_at)
      VALUES (NULL, p_payment_id, p.client_id, p.client_product_id, 'collaborator', v_collab_id, amt, v_collab_pct, new_status, pay_at);
    END IF;
  END IF;
END;
$function$;
