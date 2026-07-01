
ALTER TABLE public.sales_goals
  ADD COLUMN IF NOT EXISTS actual_value numeric NOT NULL DEFAULT 0;

ALTER TABLE public.client_journey_stages
  ADD COLUMN IF NOT EXISTS is_captation boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.recompute_sales_goals_for_month(p_month date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_week_start  date := date_trunc('week', now())::date;
  v_day_start   date := current_date;
  v_cap_mes int; v_cap_sem int; v_cap_dia int;
  v_closed int; v_atend int;
  v_fat numeric; v_rec numeric; v_avu numeric;
BEGIN
  SELECT COUNT(*) INTO v_cap_mes FROM public.clients c
    JOIN public.client_journey_stages s ON s.id = c.journey_stage_id
   WHERE s.is_captation AND c.stage_changed_at >= v_month_start AND c.stage_changed_at < v_month_end;

  SELECT COUNT(*) INTO v_cap_sem FROM public.clients c
    JOIN public.client_journey_stages s ON s.id = c.journey_stage_id
   WHERE s.is_captation AND c.stage_changed_at >= v_week_start;

  SELECT COUNT(*) INTO v_cap_dia FROM public.clients c
    JOIN public.client_journey_stages s ON s.id = c.journey_stage_id
   WHERE s.is_captation AND c.stage_changed_at >= v_day_start;

  SELECT COUNT(*) INTO v_closed FROM public.clients c
    JOIN public.client_journey_stages s ON s.id = c.journey_stage_id
   WHERE s.is_terminal AND c.stage_changed_at >= v_month_start AND c.stage_changed_at < v_month_end;

  SELECT COUNT(*) INTO v_atend FROM public.client_timeline
   WHERE event_type = 'journey_stage_change'
     AND created_at >= v_month_start AND created_at < v_month_end;

  SELECT COALESCE(SUM(amount),0) INTO v_fat FROM public.payments
   WHERE status::text = 'pago'
     AND paid_at IS NOT NULL
     AND paid_at >= v_month_start AND paid_at < v_month_end;

  SELECT
    COALESCE(SUM(CASE WHEN revenue_type = 'recurring' THEN COALESCE(amount, 0) ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN revenue_type = 'one_time'  THEN COALESCE(amount, 0) ELSE 0 END),0)
  INTO v_rec, v_avu
  FROM public.sales
  WHERE created_at >= v_month_start AND created_at < v_month_end;

  UPDATE public.sales_goals SET actual_value = v_cap_mes WHERE period_month = v_month_start AND goal_type = 'captacao_clientes_mes';
  UPDATE public.sales_goals SET actual_value = v_cap_sem WHERE period_month = v_month_start AND goal_type = 'captacao_clientes_semana';
  UPDATE public.sales_goals SET actual_value = v_cap_dia WHERE period_month = v_month_start AND goal_type = 'captacao_clientes_dia';
  UPDATE public.sales_goals SET actual_value = v_closed  WHERE period_month = v_month_start AND goal_type = 'clientes_fechados';
  UPDATE public.sales_goals SET actual_value = v_atend   WHERE period_month = v_month_start AND goal_type = 'atendimentos_realizados';
  UPDATE public.sales_goals SET actual_value = v_fat     WHERE period_month = v_month_start AND goal_type = 'faturamento';
  UPDATE public.sales_goals SET actual_value = v_rec     WHERE period_month = v_month_start AND goal_type = 'recorrencia_mensal';
  UPDATE public.sales_goals SET actual_value = v_avu     WHERE period_month = v_month_start AND goal_type = 'receita_avulsa';
END; $$;

REVOKE ALL ON FUNCTION public.recompute_sales_goals_for_month(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_sales_goals_for_month(date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_recompute_goals_current_month()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_sales_goals_for_month(date_trunc('month', now())::date);
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.trg_recompute_goals_current_month() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_goals_on_client_stage ON public.clients;
CREATE TRIGGER trg_goals_on_client_stage
AFTER UPDATE OF journey_stage_id ON public.clients
FOR EACH ROW WHEN (OLD.journey_stage_id IS DISTINCT FROM NEW.journey_stage_id)
EXECUTE FUNCTION public.trg_recompute_goals_current_month();

DROP TRIGGER IF EXISTS trg_goals_on_payment ON public.payments;
CREATE TRIGGER trg_goals_on_payment
AFTER INSERT OR UPDATE OF status, amount, paid_at ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_goals_current_month();

DROP TRIGGER IF EXISTS trg_goals_on_sale ON public.sales;
CREATE TRIGGER trg_goals_on_sale
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_goals_current_month();

SELECT public.recompute_sales_goals_for_month(date_trunc('month', now())::date);
