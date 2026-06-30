CREATE POLICY "Clients read own linked products" ON public.products
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE cp.product_id = products.id AND c.user_id = auth.uid()
  )
);