-- =====================================================================
-- Etapa 3: um número só em Vendas, Metas e Dashboard
-- ---------------------------------------------------------------------
-- 1) Parcelas geradas num lugar só (banco). Menu rápido de status e
--    formulário dão exatamente o mesmo resultado.
--    sales.amount = valor TOTAL do contrato. Recorrente: mensalidade =
--    total ÷ meses (antes o gatilho criava cada mês com o valor total).
-- 2) Metas: uma única fórmula para Metas e Dashboard, calculada no banco.
-- 3) Tempo real nas tabelas de dinheiro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Parcelas
-- ---------------------------------------------------------------------
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS installments_count integer;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS first_due_date date;
DO $$ BEGIN
  ALTER TABLE public.sales ADD CONSTRAINT sales_installments_count_check CHECK (installments_count IS NULL OR installments_count BETWEEN 1 AND 120);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Gera as parcelas que faltam. Parcelas já pagas (ou com valor pago) ficam;
-- o saldo do contrato é dividido nas parcelas restantes.
CREATE OR REPLACE FUNCTION private.generate_sale_payments(p_sale_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s            record;
  v_recurring  boolean;
  v_n          integer;
  v_kept       integer;
  v_kept_total numeric;
  v_left_n     integer;
  v_left_cents bigint;
  v_base_cents bigint;
  v_rem        bigint;
  v_start      date;
  i            integer;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND OR s.status::text <> 'concluida' OR COALESCE(s.amount, 0) <= 0 THEN
    RETURN 0;
  END IF;

  v_recurring := COALESCE(s.revenue_type, 'avulso') = 'recorrente';
  v_n := CASE WHEN v_recurring THEN GREATEST(1, LEAST(120, COALESCE(s.recurrence_months, 1)))
              ELSE GREATEST(1, LEAST(60, COALESCE(s.installments_count, 1))) END;

  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_kept, v_kept_total
    FROM public.payments
   WHERE sale_id = s.id
     AND status::text NOT IN ('cancelado','cancelada','reembolsado','estornado');

  v_left_n := v_n - v_kept;
  v_left_cents := ROUND((s.amount - v_kept_total) * 100)::bigint;
  IF v_left_n <= 0 OR v_left_cents <= 0 THEN
    RETURN 0;
  END IF;

  v_base_cents := FLOOR(v_left_cents::numeric / v_left_n)::bigint;
  v_rem := v_left_cents - v_base_cents * v_left_n;
  v_start := COALESCE(s.first_due_date,
                      CASE WHEN v_recurring THEN s.recurrence_start END,
                      s.sale_date, current_date);

  FOR i IN (v_kept + 1)..v_n LOOP
    INSERT INTO public.payments (
      sale_id, client_id, product_id, amount, due_date, status,
      installments_count, installment_number, description, is_recurring, recurrence_period
    ) VALUES (
      s.id, s.client_id, s.product_id,
      ((v_base_cents + CASE WHEN i = v_n THEN v_rem ELSE 0 END)::numeric / 100),
      (v_start + ((i - 1) || ' months')::interval)::date,
      'pendente'::payment_status,
      v_n, i,
      CASE WHEN v_recurring THEN 'Mensalidade ' || i || '/' || v_n
           WHEN v_n > 1 THEN 'Parcela ' || i || '/' || v_n
           ELSE 'Pagamento único' END,
      v_recurring,
      CASE WHEN v_recurring THEN 'monthly' END
    );
  END LOOP;
  RETURN v_left_n;
END;
$$;
REVOKE ALL ON FUNCTION private.generate_sale_payments(uuid) FROM PUBLIC, anon, authenticated;

-- Gatilho: venda concluída sem parcelas => gera; deixou de ser concluída =>
-- apaga parcelas em aberto ainda sem nenhum pagamento.
CREATE OR REPLACE FUNCTION public.sync_sale_financial_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text <> 'concluida' THEN
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.payments
       WHERE sale_id = NEW.id
         AND status::text IN ('pendente','em_aberto','parcial','parcialmente_pago','atrasado','vencido')
         AND COALESCE(amount_paid, 0) = 0;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE sale_id = NEW.id) THEN
    PERFORM private.generate_sale_payments(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_financial_schedule ON public.sales;
CREATE TRIGGER trg_sync_sale_financial_schedule
  AFTER INSERT OR UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sync_sale_financial_schedule();

-- Botão "regenerar parcelas" (admin): apaga só as parcelas em aberto sem
-- nenhum valor pago e gera de novo com a configuração atual da venda.
CREATE OR REPLACE FUNCTION public.regenerate_sale_payments(p_sale_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  DELETE FROM public.payments
   WHERE sale_id = p_sale_id
     AND status::text IN ('pendente','em_aberto','atrasado','vencido')
     AND COALESCE(amount_paid, 0) = 0;
  RETURN private.generate_sale_payments(p_sale_id);
END;
$$;
REVOKE ALL ON FUNCTION public.regenerate_sale_payments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_sale_payments(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 2) Metas: fórmula única
--    Venda realizada conta no mês em que foi concluída (closed_at, ou
--    sale_date se não houver). Receita = recebido do cliente, no mês de
--    competência da parcela, só de vendas concluídas.
-- ---------------------------------------------------------------------
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
       AND COALESCE(s.closed_at::date, s.sale_date) >= v_start
       AND COALESCE(s.closed_at::date, s.sale_date) <  v_end
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
       AND date_trunc('month', COALESCE(p.competence_month, p.due_date, p.paid_at::date))::date = v_start
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

-- Leitura pela tela (Metas e Dashboard): só admin
CREATE OR REPLACE FUNCTION public.sales_goal_actuals(p_month date, p_stage_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  RETURN private.goal_actuals(p_month, p_stage_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.sales_goal_actuals(date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_goal_actuals(date, uuid[]) TO authenticated;

-- Grava o realizado nas metas do mês (mesma fórmula). Metas personalizadas
-- (custom:...) não são tocadas.
CREATE OR REPLACE FUNCTION public.recompute_sales_goals_for_month(p_month date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a jsonb := private.goal_actuals(p_month, NULL);
  v_month date := date_trunc('month', p_month)::date;
BEGIN
  UPDATE public.sales_goals g
     SET actual_value = CASE
           WHEN g.goal_type IN ('revenue','faturamento')       THEN (a->>'revenue')::numeric
           WHEN g.goal_type = 'recorrencia_mensal'              THEN (a->>'recurring_revenue')::numeric
           WHEN g.goal_type = 'receita_avulsa'                  THEN (a->>'one_time_revenue')::numeric
           WHEN g.goal_type = 'leads'                           THEN (a->>'leads')::numeric
           WHEN g.goal_type = 'proposals'                       THEN (a->>'proposals')::numeric
           WHEN g.goal_type = 'sales_count'                     THEN (a->>'sales_count')::numeric
           WHEN g.goal_type IN ('stage_movements','atendimentos_realizados') THEN (a->>'stage_movements')::numeric
           WHEN g.goal_type = 'clients_closed'                  THEN (a->>'clients_closed')::numeric
           WHEN g.goal_type = 'clientes_fechados'               THEN (a->>'clientes_fechados')::numeric
           WHEN g.goal_type = 'captacao_clientes_mes'           THEN (a->>'captacao_mes')::numeric
           WHEN g.goal_type = 'captacao_clientes_semana'        THEN (a->>'captacao_semana')::numeric
           WHEN g.goal_type = 'captacao_clientes_dia'           THEN (a->>'captacao_dia')::numeric
           WHEN g.goal_type LIKE 'stage:%'                      THEN COALESCE((a->'stage_counts'->>substr(g.goal_type, 7))::numeric, 0)
           ELSE g.actual_value
         END
   WHERE g.period_month = v_month
     AND g.goal_type NOT LIKE 'custom:%';
END;
$$;

-- Recalcula o mês antigo e o novo da linha alterada (antes: só o mês atual)
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
      v_months := v_months || date_trunc('month', COALESCE(NEW.closed_at::date, NEW.sale_date))::date;
    END IF;
    IF TG_OP <> 'INSERT' THEN
      v_months := v_months || date_trunc('month', COALESCE(OLD.closed_at::date, OLD.sale_date))::date;
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    IF TG_OP <> 'DELETE' THEN
      v_months := v_months || date_trunc('month', COALESCE(NEW.competence_month, NEW.due_date, NEW.paid_at::date))::date;
    END IF;
    IF TG_OP <> 'INSERT' THEN
      v_months := v_months || date_trunc('month', COALESCE(OLD.competence_month, OLD.due_date, OLD.paid_at::date))::date;
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

-- Tipos de meta aceitos: os da tela de Metas, os do Dashboard, por estágio
-- e personalizados (antes só 4 tipos passavam).
ALTER TABLE public.sales_goals DROP CONSTRAINT IF EXISTS sales_goals_goal_type_check;
ALTER TABLE public.sales_goals ADD CONSTRAINT sales_goals_goal_type_check CHECK (
  goal_type IN ('leads','proposals','sales_count','revenue','stage_movements','clients_closed',
                'faturamento','recorrencia_mensal','receita_avulsa','captacao_clientes_mes',
                'captacao_clientes_semana','captacao_clientes_dia','atendimentos_realizados','clientes_fechados')
  OR goal_type LIKE 'stage:%' OR goal_type LIKE 'custom:%'
);

-- Recalcula todos os meses que têm meta cadastrada
SELECT public.recompute_sales_goals_for_month(m)
  FROM (SELECT DISTINCT period_month AS m FROM public.sales_goals WHERE period_month IS NOT NULL) x;

-- ---------------------------------------------------------------------
-- 3) Tempo real nas tabelas de dinheiro (o RLS continua valendo)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['commission_splits','commissions','expenses','sale_deductions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
