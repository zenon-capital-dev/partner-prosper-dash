-- Tabela de vínculo entre parceiros e produtos
CREATE TABLE IF NOT EXISTS public.partner_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10,
  custom_price NUMERIC(12,2),
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (partner_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_products_partner ON public.partner_products(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_products_product ON public.partner_products(product_id);

ALTER TABLE public.partner_products ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam tudo
CREATE POLICY "Admins manage partner_products"
ON public.partner_products
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Vendedores podem visualizar
CREATE POLICY "Vendedores view partner_products"
ON public.partner_products
FOR SELECT
USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::app_role));

-- Parceiro vê seus próprios vínculos
CREATE POLICY "Partner views own products"
ON public.partner_products
FOR SELECT
USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));

-- Trigger updated_at
CREATE TRIGGER trg_partner_products_updated_at
BEFORE UPDATE ON public.partner_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();