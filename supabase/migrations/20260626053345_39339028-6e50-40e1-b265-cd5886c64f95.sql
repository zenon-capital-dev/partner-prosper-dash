
-- 11/14: receita recorrente vs avulsa + closed_at
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS revenue_type text NOT NULL DEFAULT 'avulso',
  ADD COLUMN IF NOT EXISTS recurrence_months integer,
  ADD COLUMN IF NOT EXISTS recurrence_start date,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sales_closed_at ON public.sales(closed_at);
CREATE INDEX IF NOT EXISTS idx_sales_revenue_type ON public.sales(revenue_type);

CREATE OR REPLACE FUNCTION public.sales_set_closed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'finalizada' AND (OLD IS NULL OR OLD.status::text IS DISTINCT FROM 'finalizada') THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;
  IF NEW.status::text <> 'finalizada' THEN
    NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_closed_at ON public.sales;
CREATE TRIGGER trg_sales_closed_at
  BEFORE INSERT OR UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_set_closed_at();

-- Backfill: vendas finalizadas existentes
UPDATE public.sales
   SET closed_at = COALESCE(closed_at, paid_at, updated_at, created_at)
 WHERE status::text = 'finalizada' AND closed_at IS NULL;

-- 15: caixinha de projetos
ALTER TABLE public.resource_pools
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resource_pools_project ON public.resource_pools(project_id);
