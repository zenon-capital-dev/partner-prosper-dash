
-- Enrich product_steps templates and per-demand steps with operational fields
ALTER TABLE public.product_steps
  ADD COLUMN IF NOT EXISTS is_visible_to_client BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_responsible TEXT NOT NULL DEFAULT 'provider',
  ADD COLUMN IF NOT EXISTS default_due_offset_days INTEGER;

ALTER TABLE public.client_product_steps
  ADD COLUMN IF NOT EXISTS is_visible_to_client BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_responsible TEXT;

-- Trigger: when a new client_products row is created, copy product_steps template
CREATE OR REPLACE FUNCTION public.seed_client_product_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    -- Avoid duplicating if any steps were already inserted manually
    IF NOT EXISTS (SELECT 1 FROM public.client_product_steps WHERE client_product_id = NEW.id) THEN
      INSERT INTO public.client_product_steps (client_product_id, label, description, position, is_visible_to_client, default_responsible)
      SELECT NEW.id, ps.name, ps.description, COALESCE(ps.step_order, 0), ps.is_visible_to_client, ps.default_responsible
      FROM public.product_steps ps
      WHERE ps.product_id = NEW.product_id
      ORDER BY ps.step_order;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_client_product_steps ON public.client_products;
CREATE TRIGGER trg_seed_client_product_steps
AFTER INSERT ON public.client_products
FOR EACH ROW EXECUTE FUNCTION public.seed_client_product_steps();

-- Restrict client view to visible steps only
DROP POLICY IF EXISTS "Clients can view their own product steps" ON public.client_product_steps;
CREATE POLICY "Clients can view visible product steps"
ON public.client_product_steps
FOR SELECT
USING (
  is_visible_to_client = true
  AND client_product_id IN (
    SELECT cp.id FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE c.user_id = auth.uid()
  )
);
