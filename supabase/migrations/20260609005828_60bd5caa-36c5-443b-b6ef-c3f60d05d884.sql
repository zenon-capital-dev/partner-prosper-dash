CREATE OR REPLACE FUNCTION public.admin_dashboard_snapshot(p_range_key text DEFAULT 'HOJE')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  WITH period_sales AS (
    SELECT id, sale_date::date AS sale_date, COALESCE(amount, 0)::numeric AS amount, client_id
    FROM public.sales
    WHERE sale_date::date BETWEEN v_range_start AND v_range_end
  ), prev_sales AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM public.sales WHERE sale_date::date BETWEEN v_prev_start AND v_prev_end
  ), period_commissions AS (
    SELECT COALESCE(SUM(amount), 0)::numeric AS total
    FROM (
      SELECT sale_id, COALESCE(amount, 0)::numeric AS amount FROM public.commission_splits
      UNION ALL
      SELECT sale_id, COALESCE(amount, 0)::numeric AS amount FROM public.commissions
    ) c
    WHERE c.sale_id IN (SELECT id FROM period_sales)
  )
  SELECT COALESCE(SUM(amount), 0), COUNT(*), COALESCE((SELECT total FROM prev_sales), 0), COALESCE((SELECT total FROM period_commissions), 0)
  INTO v_range_revenue, v_sales_count, v_prev_revenue, v_period_commissions
  FROM period_sales;

  v_avg_ticket := CASE WHEN v_sales_count > 0 THEN v_range_revenue / v_sales_count ELSE 0 END;
  v_gross_revenue := v_range_revenue;
  v_period_taxes := v_gross_revenue * COALESCE(v_tax_rate, 0) / 100;
  v_net_revenue := v_gross_revenue - v_period_commissions - v_period_taxes;

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
    SELECT sale_id, amount::numeric, status::text, status::text AS workflow_status FROM public.commission_splits
    UNION ALL SELECT sale_id, amount::numeric, status::text, workflow_status::text FROM public.commissions
  ),
  commission_stats AS (
    SELECT COALESCE(SUM(amount) FILTER (WHERE status IN ('pendente','gerada','em_analise','aprovada','pending')), 0)::numeric AS to_pay,
      COUNT(*) FILTER (WHERE status IN ('pendente','gerada','em_analise','aprovada','pending'))::int AS count,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('pago','paga') OR workflow_status IN ('pago','paga')), 0)::numeric AS paid FROM commission_rows
  ),
  payment_stats AS (
    SELECT COALESCE(SUM((COALESCE(amount,0) - COALESCE(amount_paid,0))) FILTER (WHERE status IN ('pendente','em_aberto','parcialmente_pago') AND due_date >= v_today AND due_date <= v_today + 7), 0)::numeric AS receivable_7d,
      COUNT(*) FILTER (WHERE status IN ('pendente','em_aberto','parcialmente_pago') AND due_date >= v_today AND due_date <= v_today + 7)::int AS receivable_7d_count,
      COALESCE(SUM((COALESCE(amount,0) - COALESCE(amount_paid,0))) FILTER (WHERE status IN ('pendente','em_aberto','atrasado','vencido','parcialmente_pago') AND due_date < v_today), 0)::numeric AS overdue_amount,
      COUNT(*) FILTER (WHERE status IN ('pendente','em_aberto','atrasado','vencido','parcialmente_pago') AND due_date < v_today)::int AS overdue_count,
      COALESCE(SUM(COALESCE(amount_paid,0)) FILTER (WHERE status = 'pago'), 0)::numeric AS received_total,
      COALESCE(SUM((COALESCE(amount,0) - COALESCE(amount_paid,0))) FILTER (WHERE status IN ('pendente','em_aberto','atrasado','vencido','parcialmente_pago')), 0)::numeric AS estimated_revenue,
      COUNT(*) FILTER (WHERE status IN ('pendente','em_aberto','atrasado','vencido','parcialmente_pago'))::int AS estimated_count FROM public.payments
  ),
  chart AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', to_char(cd.day, 'DD'), 'fullDate', to_char(cd.day, 'DD/MM/YYYY'), 'value', COALESCE(s.total, 0), 'isToday', cd.day = v_today) ORDER BY cd.day), '[]'::jsonb) AS data
    FROM (SELECT (v_today - (v_chart_len - 1 - i))::date AS day FROM generate_series(0, v_chart_len - 1) i) cd
    LEFT JOIN (SELECT sale_date::date AS day, SUM(COALESCE(amount,0))::numeric AS total FROM public.sales WHERE sale_date::date BETWEEN v_today - (v_chart_len - 1) AND v_today GROUP BY sale_date::date) s ON s.day = cd.day
  ),
  recent_sales AS (
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.sale_date DESC), '[]'::jsonb) AS data FROM (SELECT s.id, s.sale_date, s.amount, s.client_id, COALESCE(c.full_name, 'Cliente') AS client FROM public.sales s LEFT JOIN public.clients c ON c.id = s.client_id WHERE s.sale_date::date BETWEEN v_range_start AND v_range_end ORDER BY s.sale_date DESC LIMIT 7) x
  ),
  top_clients AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'total', total) ORDER BY total DESC), '[]'::jsonb) AS data, COALESCE(MAX(total), 1)::numeric AS max_total FROM (SELECT c.id, COALESCE(c.full_name, 'Cliente') AS name, SUM(COALESCE(s.amount,0))::numeric AS total FROM public.sales s JOIN public.clients c ON c.id = s.client_id WHERE s.sale_date::date BETWEEN v_range_start - v_period_days AND v_range_end GROUP BY c.id, c.full_name ORDER BY total DESC LIMIT 5) x
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
      'grossRevenue', v_gross_revenue, 'netRevenue', v_net_revenue, 'commissionsPaid', cms.paid, 'periodCommissions', v_period_commissions, 'periodTaxes', v_period_taxes, 'taxRate', COALESCE(v_tax_rate, 0), 'estimatedRevenue', ps.estimated_revenue, 'estimatedRevenueCount', ps.estimated_count,
      'chartData', chart.data, 'demandsByStatus', jsonb_strip_nulls(jsonb_build_array(CASE WHEN ds.in_progress > 0 THEN jsonb_build_object('name','Em andamento','value',ds.in_progress,'color','#4f46e5') END, CASE WHEN ds.waiting > 0 THEN jsonb_build_object('name','Aguardando','value',ds.waiting,'color','#f59e0b') END, CASE WHEN ds.completed > 0 THEN jsonb_build_object('name','Concluídas','value',ds.completed,'color','#10b981') END, CASE WHEN ds.delayed > 0 THEN jsonb_build_object('name','Atrasadas','value',ds.delayed,'color','#f43f5e') END, CASE WHEN ds.paused > 0 THEN jsonb_build_object('name','Pausadas','value',ds.paused,'color','#94a3b8') END))
    ) || jsonb_build_object(
      'leadsByStage', jsonb_build_array(jsonb_build_object('name','Novos','value',ls.novos), jsonb_build_object('name','Qualificados','value',ls.qualificados), jsonb_build_object('name','Proposta','value',ls.proposta), jsonb_build_object('name','Ganhos','value',ls.won)),
      'recentSales', recent_sales.data, 'topClients', top_clients.data, 'maxTopClient', top_clients.max_total, 'healthScore', CASE WHEN v_total_demands > 0 THEN ROUND((v_healthy_demands::numeric / v_total_demands::numeric) * 100) ELSE 100 END, 'salesCount', v_sales_count,
      'todayTasksList', task_list.data, 'todayDemandsList', demand_list.data, 'todayDocsList', doc_list.data, 'todayContractsList', contract_list.data, 'todayAgendaList', agenda_list.data,
      'todayPendingCount', jsonb_array_length(task_list.data) + jsonb_array_length(demand_list.data) + jsonb_array_length(doc_list.data) + jsonb_array_length(contract_list.data) + jsonb_array_length(agenda_list.data), 'activityLogs', activity_list.data
    )
  INTO v_json
  FROM clients_stats cs, demand_stats ds, lead_stats ls, contract_stats cts, doc_stats docs, task_stats ts, commission_stats cms, payment_stats ps, chart, recent_sales, top_clients, task_list, demand_list, doc_list, contract_list, agenda_list, activity_list;

  RETURN v_json;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_snapshot(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_snapshot(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_snapshot(text) TO authenticated;