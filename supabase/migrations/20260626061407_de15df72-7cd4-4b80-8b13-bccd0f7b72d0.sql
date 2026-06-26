ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sales_closed_at_revenue_type ON public.sales(closed_at, revenue_type);

-- Trigger: marcar cliente como "Fechado" quando uma venda dele for finalizada
CREATE OR REPLACE FUNCTION public.mark_client_closed_on_sale_finalized()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'concluida' AND (OLD.status IS DISTINCT FROM 'concluida') AND NEW.client_id IS NOT NULL THEN
    UPDATE public.clients SET is_closed = true WHERE id = NEW.client_id AND is_closed = false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mark_client_closed ON public.sales;
CREATE TRIGGER trg_mark_client_closed
  AFTER INSERT OR UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.mark_client_closed_on_sale_finalized();

-- Backfill: clientes que já têm venda finalizada
UPDATE public.clients c SET is_closed = true
WHERE EXISTS (SELECT 1 FROM public.sales s WHERE s.client_id = c.id AND s.status = 'concluida')
  AND c.is_closed = false;