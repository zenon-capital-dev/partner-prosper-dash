ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS resource_pool_id uuid REFERENCES public.resource_pools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_resource_pool_id
  ON public.sales(resource_pool_id);

CREATE OR REPLACE FUNCTION public.credit_project_pool_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_pool_id uuid;
  v_amount numeric;
BEGIN
  IF NEW.paid_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.paid_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.sale_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT resource_pool_id, project_id
    INTO v_pool_id, v_project_id
  FROM public.sales
  WHERE id = NEW.sale_id;

  IF v_pool_id IS NULL AND v_project_id IS NOT NULL THEN
    SELECT id INTO v_pool_id
    FROM public.resource_pools
    WHERE project_id = v_project_id AND active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_pool_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NEW.amount_paid, NEW.amount, 0);
  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.resource_pool_movements
    (pool_id, movement_type, amount, description, reference_type, reference_id, occurred_at)
  VALUES
    (v_pool_id, 'entrada', v_amount,
     'Crédito automático: pagamento recebido de venda vinculada',
     'payment', NEW.id, COALESCE(NEW.paid_at::date, CURRENT_DATE))
  ON CONFLICT (reference_id) WHERE reference_type = 'payment' DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_project_pool ON public.payments;
CREATE TRIGGER trg_credit_project_pool
AFTER INSERT OR UPDATE OF paid_at ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.credit_project_pool_on_payment();