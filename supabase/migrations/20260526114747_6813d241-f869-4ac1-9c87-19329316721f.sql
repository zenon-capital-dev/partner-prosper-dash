DROP POLICY IF EXISTS "Authenticated can read products" ON public.products;

CREATE POLICY "Internal roles can read products"
ON public.products
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_secondary'::public.app_role)
  OR public.has_role(auth.uid(), 'vendedor'::public.app_role)
  OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  OR public.has_role(auth.uid(), 'parceiro'::public.app_role)
  OR public.has_role(auth.uid(), 'prestador'::public.app_role)
);