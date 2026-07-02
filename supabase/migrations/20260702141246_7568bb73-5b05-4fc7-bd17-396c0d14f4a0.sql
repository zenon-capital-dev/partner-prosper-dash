CREATE OR REPLACE FUNCTION public.sync_sale_financial_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_installments int := 1;
  v_total_cents bigint;
  v_base_cents bigint;
  v_remainder bigint;
  v_start date;
  i int;
BEGIN
  IF NEW.status::text <> 'concluida' THEN
    DELETE FROM public.payments
     WHERE sale_id = NEW.id
       AND status::text IN ('pendente','em_aberto','parcial','parcialmente_pago','atrasado','vencido')
       AND COALESCE(amount_paid, 0) = 0;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.payments WHERE sale_id = NEW.id;
  IF v_count > 0 THEN
    RETURN NEW;
  END IF;

  v_start := COALESCE(NEW.recurrence_start, NEW.sale_date, current_date);

  IF COALESCE(NEW.revenue_type, 'avulso') = 'recorrente' THEN
    v_installments := GREATEST(1, LEAST(120, COALESCE(NEW.recurrence_months, 1)));
    FOR i IN 1..v_installments LOOP
      INSERT INTO public.payments (
        sale_id, client_id, product_id, amount, due_date, status,
        installments_count, installment_number, description, is_recurring, recurrence_period
      ) VALUES (
        NEW.id, NEW.client_id, NEW.product_id, COALESCE(NEW.amount,0),
        (v_start + ((i - 1) || ' months')::interval)::date, 'pendente'::payment_status,
        v_installments, i, 'Mensalidade ' || i || '/' || v_installments, true, 'monthly'
      );
    END LOOP;
  ELSE
    v_installments := 1;
    v_total_cents := ROUND(COALESCE(NEW.amount,0) * 100)::bigint;
    v_base_cents := FLOOR(v_total_cents::numeric / v_installments)::bigint;
    v_remainder := v_total_cents - (v_base_cents * v_installments);

    FOR i IN 1..v_installments LOOP
      INSERT INTO public.payments (
        sale_id, client_id, product_id, amount, due_date, status,
        installments_count, installment_number, description, is_recurring
      ) VALUES (
        NEW.id, NEW.client_id, NEW.product_id,
        ((v_base_cents + CASE WHEN i = v_installments THEN v_remainder ELSE 0 END)::numeric / 100),
        (v_start + ((i - 1) || ' months')::interval)::date, 'pendente'::payment_status,
        v_installments, i, 'Pagamento único', false
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_sale_financial_schedule ON public.sales;
CREATE TRIGGER trg_sync_sale_financial_schedule
AFTER INSERT OR UPDATE OF status, amount, product_id, client_id, sale_date, recurrence_start, recurrence_months, revenue_type
ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.sync_sale_financial_schedule();