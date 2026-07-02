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

  v_partner_base := GREATEST(COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0), 0);

  IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent, 0) > 0 THEN
    INSERT INTO public.commissions (partner_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.partner_id, NEW.id, NEW.client_id, NEW.product_id, ROUND((v_partner_base * NEW.commission_percent)/100,2), NEW.commission_percent, v_partner_base, 'pendente','aguardando_confirmacao','Comissão de Parceiro gerada via venda '||NEW.id,'percentual');
  END IF;

  IF NEW.referrer_id IS NOT NULL AND COALESCE(NEW.referrer_percent, 0) > 0 THEN
    INSERT INTO public.commissions (referrer_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.referrer_id, NEW.id, NEW.client_id, NEW.product_id, ROUND((NEW.amount * NEW.referrer_percent)/100,2), NEW.referrer_percent, NEW.amount, 'pendente','aguardando_confirmacao','Comissão de Indicador gerada via venda '||NEW.id,'percentual');
  END IF;

  IF NEW.collaborator_id IS NOT NULL AND COALESCE(NEW.collaborator_percent, 0) > 0 THEN
    INSERT INTO public.commissions (collaborator_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.collaborator_id, NEW.id, NEW.client_id, NEW.product_id, ROUND((NEW.amount * NEW.collaborator_percent)/100,2), NEW.collaborator_percent, NEW.amount, 'pendente','aguardando_confirmacao','Comissão de Colaborador gerada via venda '||NEW.id,'percentual');
  END IF;

  IF NEW.service_provider_id IS NOT NULL AND COALESCE(NEW.provider_cost, 0) > 0 THEN
    INSERT INTO public.commissions (service_provider_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.service_provider_id, NEW.id, NEW.client_id, NEW.product_id, ROUND(NEW.provider_cost,2), 0, NEW.amount, 'pendente','aguardando_confirmacao','Repasse ao Prestador gerado via venda '||NEW.id,'fixo');
  END IF;

  RETURN NEW;
END;
$function$;

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

  v_partner_base := GREATEST(COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0), 0);
  v_partner_amount  := (v_partner_base * COALESCE(NEW.commission_percent, 0)) / 100;
  v_referrer_amount := (NEW.amount * COALESCE(NEW.referrer_percent, 0)) / 100;
  v_collab_amount   := (NEW.amount * COALESCE(NEW.collaborator_percent, 0)) / 100;
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

DROP TRIGGER IF EXISTS on_sale_created ON public.sales;
CREATE TRIGGER on_sale_created
AFTER INSERT OR UPDATE OF status, amount, zenon_cost, provider_cost, partner_id, referrer_id, collaborator_id, service_provider_id, commission_percent, referrer_percent, collaborator_percent
ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_sale();

DROP TRIGGER IF EXISTS on_sale_created_splits ON public.sales;
CREATE TRIGGER on_sale_created_splits
AFTER INSERT OR UPDATE OF status, amount, zenon_cost, provider_cost, partner_id, referrer_id, collaborator_id, service_provider_id, commission_percent, referrer_percent, collaborator_percent
ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_sale_splits();

CREATE OR REPLACE FUNCTION public.maybe_release_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_status text;
BEGIN
  SELECT status::text INTO v_sale_status
  FROM public.sales
  WHERE id = NEW.sale_id;

  -- Pagamento de venda ainda em negociação não libera comissão.
  IF COALESCE(v_sale_status, '') <> 'concluida' THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text = 'pago' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status::text <> 'pago') THEN
    UPDATE public.commissions
    SET workflow_status = 'liberada',
        status = 'pago',
        paid_at = COALESCE(paid_at, now()),
        approval_date = COALESCE(approval_date, now()),
        payment_date = COALESCE(payment_date, now()),
        updated_at = now()
    WHERE sale_id = NEW.sale_id
      AND (status::text NOT IN ('pago','paga','cancelada') OR workflow_status IN ('aguardando_confirmacao','pendente'));

    UPDATE public.commission_splits
    SET status = 'pago'::split_status,
        paid_at = COALESCE(paid_at, now()),
        updated_at = now()
    WHERE sale_id = NEW.sale_id
      AND status::text NOT IN ('pago','paga','cancelada');
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status::text <> 'pago' AND OLD.status::text = 'pago' THEN
    UPDATE public.commissions
    SET status = 'pendente',
        workflow_status = 'aguardando_confirmacao',
        paid_at = NULL,
        payment_date = NULL,
        updated_at = now()
    WHERE sale_id = NEW.sale_id;

    UPDATE public.commission_splits
    SET status = 'pendente'::split_status,
        paid_at = NULL,
        updated_at = now()
    WHERE sale_id = NEW.sale_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_snapshot(p_range_key text DEFAULT 'HOJE'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_range_start date;
  v_range_end date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_period_days int;
  v_prev_start date;
  v_prev_end date;
  v_chart_len int;
  v_tax_rate numeric := 0;
  v_range_revenue numeric := 0;
  v_prev_revenue numeric := 0;
  v_avg_ticket numeric := 0;
  v_sales_count int := 0;
  v_period_commissions numeric := 0;
  v_period_received numeric := 0;
  v_period_sales_costs numeric := 0;
  v_gross_revenue numeric := 0;
  v_net_revenue numeric := 0;
  v_period_taxes numeric := 0;
  v_total_demands int := 0;
  v_healthy_demands int := 0;
  v_json jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  v_range_start := CASE p_range_key WHEN '7D' THEN v_today - 6 WHEN '30D' THEN v_today - 29 WHEN 'MÊS' THEN date_trunc('month', v_today)::date ELSE v_today END;
  v_period_days := GREATEST(1, (v_range_end - v_range_start) + 1);
  v_prev_start := v_range_start - v_period_days;
  v_prev_end := v_range_start - 1;
  v_chart_len := CASE p_range_key WHEN '30D' THEN 30 WHEN 'MÊS' THEN EXTRACT(day FROM v_today)::int ELSE 7 END;

  SELECT COALESCE(CASE WHEN jsonb_typeof(value) = 'object' THEN NULLIF(value->>'value', '')::numeric ELSE NULLIF(value #>> '{}', '')::numeric END, 0)
  INTO v_tax_rate
  FROM public.system_settings
  WHERE key = 'tax_rate_percent'
  LIMIT 1;

  WITH finalized_sales AS (
    SELECT id, sale_date::date AS sale_date, COALESCE(amount, 0)::numeric AS amount, client_id,
           COALESCE(zenon_cost,0)::numeric AS zenon_cost, COALESCE(provider_cost,0)::numeric AS provider_cost
    FROM public.sales
    WHERE status::text = 'concluida'
  ), period_sales AS (
    SELECT * FROM finalized_sales WHERE sale_date BETWEEN v_range_start AND v_range_end
  ), prev_sales AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM finalized_sales WHERE sale_date BETWEEN v_prev_start AND v_prev_end
  ), received_by_sale AS (
    SELECT p.sale_id, COALESCE(SUM(CASE WHEN p.status::text IN ('pago','paga','parcial','parcialmente_pago') THEN GREATEST(COALESCE(p.amount_paid,0), COALESCE(p.amount,0)) ELSE 0 END),0)::numeric AS received
    FROM public.payments p
    JOIN period_sales s ON s.id = p.sale_id
    WHERE p.status::text NOT IN ('cancelado','cancelada','reembolsado','estornado')
    GROUP BY p.sale_id
  ), period_commissions AS (
    SELECT COALESCE(SUM(c.amount * LEAST(1, COALESCE(r.received,0) / NULLIF(ps.amount,0))), 0)::numeric AS total
    FROM (
      SELECT sale_id, COALESCE(amount, 0)::numeric AS amount FROM public.commission_splits
      UNION ALL
      SELECT sale_id, COALESCE(amount, 0)::numeric AS amount FROM public.commissions
    ) c
    JOIN period_sales ps ON ps.id = c.sale_id
    LEFT JOIN received_by_sale r ON r.sale_id = c.sale_id
  )
  SELECT COALESCE(SUM(ps.amount), 0), COUNT(*), COALESCE((SELECT total FROM prev_sales), 0),
         COALESCE((SELECT total FROM period_commissions), 0), COALESCE(SUM(COALESCE(r.received,0)), 0),
         COALESCE(SUM((ps.zenon_cost + ps.provider_cost) * LEAST(1, COALESCE(r.received,0) / NULLIF(ps.amount,0))), 0)
  INTO v_range_revenue, v_sales_count, v_prev_revenue, v_period_commissions, v_period_received, v_period_sales_costs
  FROM period_sales ps
  LEFT JOIN received_by_sale r ON r.sale_id = ps.id;

  v_avg_ticket := CASE WHEN v_sales_count > 0 THEN v_range_revenue / v_sales_count ELSE 0 END;
  v_gross_revenue := v_range_revenue;
  v_period_taxes := v_period_received * COALESCE(v_tax_rate, 0) / 100;
  v_net_revenue := v_period_received - v_period_sales_costs - v_period_commissions - v_period_taxes;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status <> 'atrasado') INTO v_total_demands, v_healthy_demands FROM public.client_products;

  WITH
  clients_stats AS (
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'ativo')::int AS active, COUNT(*) FILTER (WHERE created_at::date >= v_range_start)::int AS new_range FROM public.clients
  ),
  demand_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(status,'') NOT IN ('concluido','concluida','cancelado','cancelada') AND (status = 'atrasado' OR COALESCE(deadline, sla_due_date, end_date)::date < v_today))::int AS delayed,
      COUNT(*) FILTER (WHERE status IN ('em_andamento','aguardando_inicio','em_execucao','pausado','ajuste_solicitado'))::int AS active,
      COUNT(*) FILTER (WHERE status IN ('concluido','concluida'))::int AS completed,
      COUNT(*) FILTER (WHERE status IN ('em_andamento','em_execucao','ajuste_solicitado'))::int AS in_progress,
      COUNT(*) FILTER (WHERE status = 'aguardando_inicio')::int AS waiting,
      COUNT(*) FILTER (WHERE status = 'pausado')::int AS paused
    FROM public.client_products
  ),
  lead_stats AS (
    SELECT COUNT(*)::int AS total, COALESCE(SUM(COALESCE(estimated_value, 0)), 0)::numeric AS pipeline,
      COUNT(*) FILTER (WHERE status IN ('ganho','convertido'))::int AS won, COUNT(*) FILTER (WHERE status = 'perdido')::int AS lost,
      COUNT(*) FILTER (WHERE status IN ('novo','new'))::int AS novos, COUNT(*) FILTER (WHERE status = 'qualificado')::int AS qualificados,
      COUNT(*) FILTER (WHERE status IN ('proposta','negociacao'))::int AS proposta FROM public.leads
  ),
  contract_stats AS (
    SELECT COUNT(*) FILTER (WHERE status::text IN ('criado','enviado','aguardando_assinatura'))::int AS open,
      COUNT(*) FILTER (WHERE status::text IN ('aguardando_assinatura','enviado'))::int AS waiting FROM public.contracts
  ),
  doc_stats AS (
    SELECT COUNT(*) FILTER (WHERE status::text IN ('solicitado','pendente_correcao','pendente','enviado','em_analise'))::int AS pending FROM public.documents
  ),
  task_stats AS (
    SELECT COUNT(*) FILTER (WHERE COALESCE(status_new::text, status, '') NOT IN ('concluida','cancelada','completed','done','cancelled'))::int AS open,
      COUNT(*) FILTER (WHERE COALESCE(status_new::text, status, '') NOT IN ('concluida','cancelada','completed','done','cancelled') AND due_date::date < v_today)::int AS overdue,
      COUNT(*) FILTER (WHERE COALESCE(status_new::text, status, '') NOT IN ('concluida','cancelada','completed','done','cancelled') AND due_date::date = v_today)::int AS today FROM public.tasks
  ),
  commission_rows AS (
    SELECT c.sale_id, c.amount::numeric, c.status::text, c.status::text AS workflow_status FROM public.commission_splits c JOIN public.sales s ON s.id = c.sale_id WHERE s.status::text = 'concluida'
    UNION ALL SELECT c.sale_id, c.amount::numeric, c.status::text, c.workflow_status::text FROM public.commissions c JOIN public.sales s ON s.id = c.sale_id WHERE s.status::text = 'concluida'
  ),
  commission_stats AS (
    SELECT COALESCE(SUM(amount) FILTER (WHERE status IN ('pendente','gerada','em_analise','aprovada','pending')), 0)::numeric AS to_pay,
      COUNT(*) FILTER (WHERE status IN ('pendente','gerada','em_analise','aprovada','pending'))::int AS count,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('pago','paga') OR workflow_status IN ('pago','paga')), 0)::numeric AS paid FROM commission_rows
  ),
  payment_stats AS (
    SELECT COALESCE(SUM((COALESCE(p.amount,0) - COALESCE(p.amount_paid,0))) FILTER (WHERE s.status::text = 'concluida' AND p.status::text IN ('pendente','em_aberto','parcialmente_pago') AND p.due_date >= v_today AND p.due_date <= v_today + 7), 0)::numeric AS receivable_7d,
      COUNT(*) FILTER (WHERE s.status::text = 'concluida' AND p.status::text IN ('pendente','em_aberto','parcialmente_pago') AND p.due_date >= v_today AND p.due_date <= v_today + 7)::int AS receivable_7d_count,
      COALESCE(SUM((COALESCE(p.amount,0) - COALESCE(p.amount_paid,0))) FILTER (WHERE s.status::text = 'concluida' AND p.status::text IN ('pendente','em_aberto','atrasado','vencido','parcialmente_pago') AND p.due_date < v_today), 0)::numeric AS overdue_amount,
      COUNT(*) FILTER (WHERE s.status::text = 'concluida' AND p.status::text IN ('pendente','em_aberto','atrasado','vencido','parcialmente_pago') AND p.due_date < v_today)::int AS overdue_count,
      COALESCE(SUM(COALESCE(p.amount_paid,0)) FILTER (WHERE s.status::text = 'concluida' AND p.status::text = 'pago'), 0)::numeric AS received_total,
      COALESCE(SUM((COALESCE(p.amount,0) - COALESCE(p.amount_paid,0))) FILTER (WHERE s.status::text = 'concluida' AND p.status::text IN ('pendente','em_aberto','atrasado','vencido','parcialmente_pago')), 0)::numeric AS estimated_revenue,
      COUNT(*) FILTER (WHERE s.status::text = 'concluida' AND p.status::text IN ('pendente','em_aberto','atrasado','vencido','parcialmente_pago'))::int AS estimated_count
    FROM public.payments p
    LEFT JOIN public.sales s ON s.id = p.sale_id
  ),
  chart AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', to_char(cd.day, 'DD'), 'fullDate', to_char(cd.day, 'DD/MM/YYYY'), 'value', COALESCE(s.total, 0), 'isToday', cd.day = v_today) ORDER BY cd.day), '[]'::jsonb) AS data
    FROM (SELECT (v_today - (v_chart_len - 1 - i))::date AS day FROM generate_series(0, v_chart_len - 1) i) cd
    LEFT JOIN (SELECT sale_date::date AS day, SUM(COALESCE(amount,0))::numeric AS total FROM public.sales WHERE status::text = 'concluida' AND sale_date::date BETWEEN v_today - (v_chart_len - 1) AND v_today GROUP BY sale_date::date) s ON s.day = cd.day
  ),
  recent_sales AS (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.sale_date DESC), '[]'::jsonb) AS data FROM (SELECT s.id, s.sale_date, s.amount, s.client_id, COALESCE(c.full_name, 'Cliente') AS client FROM public.sales s LEFT JOIN public.clients c ON c.id = s.client_id WHERE s.status::text = 'concluida' AND s.sale_date::date BETWEEN v_range_start AND v_range_end ORDER BY s.sale_date DESC LIMIT 7) x
  ),
  top_clients AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'total', total) ORDER BY total DESC), '[]'::jsonb) AS data, COALESCE(MAX(total), 1)::numeric AS max_total FROM (SELECT c.id, COALESCE(c.full_name, 'Cliente') AS name, SUM(COALESCE(s.amount,0))::numeric AS total FROM public.sales s JOIN public.clients c ON c.id = s.client_id WHERE s.status::text = 'concluida' AND s.sale_date::date BETWEEN v_range_start - v_period_days AND v_range_end GROUP BY c.id, c.full_name ORDER BY total DESC LIMIT 5) x
  ),
  task_list AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'time', time, 'isOverdue', is_overdue) ORDER BY due_date), '[]'::jsonb) AS data FROM (SELECT id, COALESCE(title, 'Tarefa sem título') AS title, due_date, to_char(due_date AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS time, due_date < now() AS is_overdue FROM public.tasks WHERE COALESCE(status_new::text, status, '') NOT IN ('concluida','cancelada','completed','done','cancelled') AND due_date::date = v_today ORDER BY due_date LIMIT 5) x
  ),
  demand_list AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'subtitle', subtitle)), '[]'::jsonb) AS data FROM (SELECT cp.id, COALESCE(c.full_name, 'Cliente') AS title, COALESCE(cp.custom_product_name, 'Serviço') AS subtitle FROM public.client_products cp LEFT JOIN public.clients c ON c.id = cp.client_id WHERE COALESCE(cp.status,'') NOT IN ('concluido','concluida','cancelado','cancelada') AND COALESCE(cp.deadline, cp.sla_due_date, cp.end_date)::date = v_today ORDER BY cp.created_at DESC LIMIT 5) x
  ),
  doc_list AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'subtitle', subtitle)), '[]'::jsonb) AS data FROM (SELECT d.id, COALESCE(d.name, 'Documento') AS title, COALESCE(c.full_name, 'Cliente') AS subtitle FROM public.documents d LEFT JOIN public.clients c ON c.id = d.client_id WHERE d.status::text IN ('solicitado','pendente','enviado','em_analise','pendente_correcao') ORDER BY d.created_at DESC LIMIT 5) x
  ),
  contract_list AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'subtitle', 'Aguardando assinatura')), '[]'::jsonb) AS data FROM (SELECT id, COALESCE(name, 'Contrato') AS title FROM public.contracts WHERE status::text IN ('aguardando_assinatura','enviado') ORDER BY created_at DESC LIMIT 5) x
  ),
  agenda_list AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'subtitle', subtitle, 'isOverdue', is_overdue)), '[]'::jsonb) AS data FROM (SELECT i.id, COALESCE(c.full_name, 'Cliente') AS title, COALESCE(i.next_action_note, 'Ação agendada') AS subtitle, (i.next_action_at::date < v_today AND i.status = 'pendente') AS is_overdue FROM public.client_interactions i LEFT JOIN public.clients c ON c.id = i.client_id WHERE i.next_action_at = v_today AND i.status = 'pendente' LIMIT 5) x
  ),
  activity_list AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'action', action, 'entity_type', entity_type, 'entity_id', entity_id, 'created_at', created_at, 'user_id', user_id) ORDER BY created_at DESC), '[]'::jsonb) AS data FROM (SELECT id, action, entity_type, entity_id, created_at, user_id FROM public.activity_logs ORDER BY created_at DESC LIMIT 8) x
  )
  SELECT
    jsonb_build_object(
      'rangeRevenue', v_range_revenue, 'revenueDelta', CASE WHEN v_prev_revenue > 0 THEN ((v_range_revenue - v_prev_revenue) / v_prev_revenue) * 100 WHEN v_range_revenue > 0 THEN 100 ELSE 0 END, 'prevRevenue', v_prev_revenue, 'avgTicket', v_avg_ticket,
      'activeClients', cs.active, 'totalClients', cs.total, 'newClientsRange', cs.new_range,
      'delayedDemands', ds.delayed, 'activeDemands', ds.active, 'completedDemands', ds.completed,
      'pipelineTotal', ls.pipeline, 'leadsCount', ls.total, 'wonLeads', ls.won, 'lostLeads', ls.lost, 'conversionRate', CASE WHEN ls.total > 0 THEN (ls.won::numeric / ls.total::numeric) * 100 ELSE 0 END,
      'openContracts', cts.open, 'waitingSignatureContracts', cts.waiting, 'pendingDocs', docs.pending, 'overdueTasks', ts.overdue, 'todayTasks', ts.today, 'openTasks', ts.open
    ) || jsonb_build_object(
      'commissionsToPay', cms.to_pay, 'commissionsCount', cms.count, 'receivable7d', ps.receivable_7d, 'receivable7dCount', ps.receivable_7d_count, 'overdueAmount', ps.overdue_amount, 'overdueCount', ps.overdue_count, 'receivedTotal', ps.received_total,
      'grossRevenue', v_gross_revenue, 'netRevenue', v_net_revenue, 'periodReceived', v_period_received, 'commissionsPaid', cms.paid, 'periodCommissions', v_period_commissions, 'periodTaxes', v_period_taxes, 'periodSalesCosts', v_period_sales_costs, 'taxRate', COALESCE(v_tax_rate, 0), 'estimatedRevenue', ps.estimated_revenue, 'estimatedRevenueCount', ps.estimated_count,
      'chartData', chart.data, 'demandsByStatus', jsonb_strip_nulls(jsonb_build_array(CASE WHEN ds.in_progress > 0 THEN jsonb_build_object('name','Em andamento','value',ds.in_progress,'color','#4f46e5') END, CASE WHEN ds.waiting > 0 THEN jsonb_build_object('name','Aguardando','value',ds.waiting,'color','#f59e0b') END, CASE WHEN ds.completed > 0 THEN jsonb_build_object('name','Concluídas','value',ds.completed,'color','#10b981') END, CASE WHEN ds.delayed > 0 THEN jsonb_build_object('name','Atrasadas','value',ds.delayed,'color','#f43f5e') END, CASE WHEN ds.paused > 0 THEN jsonb_build_object('name','Pausadas','value',ds.paused,'color','#94a3b8') END))
    ) || jsonb_build_object(
      'leadsByStage', jsonb_build_array(jsonb_build_object('name','Novos','value',ls.novos), jsonb_build_object('name','Qualificados','value',ls.qualificados), jsonb_build_object('name','Proposta','value',ls.proposta), jsonb_build_object('name','Ganhos','value',ls.won)),
      'recentSales', recent_sales.data, 'topClients', top_clients.data, 'maxTopClient', top_clients.max_total, 'healthScore', CASE WHEN v_total_demands > 0 THEN ROUND((v_healthy_demands::numeric / v_total_demands::numeric) * 100) ELSE 100 END, 'salesCount', v_sales_count,
      'todayTasksList', task_list.data, 'todayDemandsList', demand_list.data, 'todayDocsList', doc_list.data, 'todayContractsList', doc_list.data, 'todayAgendaList', agenda_list.data,
      'todayPendingCount', jsonb_array_length(task_list.data) + jsonb_array_length(demand_list.data) + jsonb_array_length(doc_list.data) + jsonb_array_length(contract_list.data) + jsonb_array_length(agenda_list.data), 'activityLogs', activity_list.data
    )
  INTO v_json
  FROM clients_stats cs, demand_stats ds, lead_stats ls, contract_stats cts, doc_stats docs, task_stats ts, commission_stats cms, payment_stats ps, chart, recent_sales, top_clients, task_list, demand_list, doc_list, contract_list, agenda_list, activity_list;

  RETURN v_json;
END;
$function$;