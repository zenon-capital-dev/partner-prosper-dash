
DROP POLICY IF EXISTS "Todos autenticados leem estágios" ON public.client_journey_stages;
CREATE POLICY "Internal roles read journey stages" ON public.client_journey_stages
FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_secondary'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'colaborador'::app_role)
);

DROP POLICY IF EXISTS "Authenticated users can read product steps" ON public.product_steps;
CREATE POLICY "Internal roles read product steps" ON public.product_steps
FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_secondary'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'colaborador'::app_role)
  OR has_role(auth.uid(), 'prestador'::app_role)
);

DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
