
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS stage_id_at_sale uuid;

CREATE OR REPLACE FUNCTION public.set_sale_stage_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Snapshot do estágio do cliente no momento em que a venda vira concluída
  IF NEW.stage_id_at_sale IS NULL AND NEW.status = 'concluida' AND NEW.client_id IS NOT NULL THEN
    SELECT c.journey_stage_id INTO NEW.stage_id_at_sale
    FROM public.clients c
    WHERE c.id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_sale_stage_snapshot ON public.sales;
CREATE TRIGGER trg_set_sale_stage_snapshot
BEFORE INSERT OR UPDATE OF status, client_id ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.set_sale_stage_snapshot();

-- Backfill para vendas já concluídas sem snapshot: usa o estágio atual do cliente
UPDATE public.sales s
SET stage_id_at_sale = c.journey_stage_id
FROM public.clients c
WHERE s.client_id = c.id
  AND s.status = 'concluida'
  AND s.stage_id_at_sale IS NULL
  AND c.journey_stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_stage_at_sale ON public.sales(stage_id_at_sale);
