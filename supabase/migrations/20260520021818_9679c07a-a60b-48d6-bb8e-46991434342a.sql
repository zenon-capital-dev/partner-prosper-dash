-- 1. Coluna de rastreamento
ALTER TABLE public.client_products
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS client_products_sale_id_uniq
  ON public.client_products(sale_id) WHERE sale_id IS NOT NULL;

-- 2. Função de sincronização
CREATE OR REPLACE FUNCTION public.sync_sale_to_client_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_target_status text;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_target_status := CASE
    WHEN NEW.status::text = 'cancelada' THEN 'cancelado'
    ELSE 'em_andamento'
  END;

  SELECT id INTO v_existing_id
  FROM public.client_products
  WHERE sale_id = NEW.id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Atualiza status se a venda mudou de estado
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      UPDATE public.client_products
      SET status = v_target_status,
          updated_at = now()
      WHERE id = v_existing_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Não cria client_product para venda já cancelada na origem
  IF NEW.status::text = 'cancelada' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.client_products (
    client_id, product_id, sale_id, status, value, start_date
  )
  VALUES (
    NEW.client_id, NEW.product_id, NEW.id, v_target_status,
    NEW.amount, COALESCE(NEW.sale_date, CURRENT_DATE)
  );

  RETURN NEW;
END;
$$;

-- 3. Triggers
DROP TRIGGER IF EXISTS trg_sync_sale_to_client_product_ins ON public.sales;
CREATE TRIGGER trg_sync_sale_to_client_product_ins
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_sale_to_client_product();

DROP TRIGGER IF EXISTS trg_sync_sale_to_client_product_upd ON public.sales;
CREATE TRIGGER trg_sync_sale_to_client_product_upd
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_sale_to_client_product();

-- 4. Backfill das vendas existentes
INSERT INTO public.client_products (client_id, product_id, sale_id, status, value, start_date)
SELECT
  s.client_id,
  s.product_id,
  s.id,
  CASE WHEN s.status::text = 'cancelada' THEN 'cancelado' ELSE 'em_andamento' END,
  s.amount,
  COALESCE(s.sale_date, CURRENT_DATE)
FROM public.sales s
LEFT JOIN public.client_products cp ON cp.sale_id = s.id
WHERE cp.id IS NULL
  AND s.product_id IS NOT NULL
  AND s.client_id IS NOT NULL;