
CREATE POLICY "Partners update related documents"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (
    ((client_id IS NOT NULL) AND private.is_partner_for_client((SELECT auth.uid()), client_id))
    OR ((client_product_id IS NOT NULL) AND (client_product_id IN (
      SELECT cp.id FROM public.client_products cp
      WHERE private.is_partner_for_client((SELECT auth.uid()), cp.client_id)
    )))
  )
  WITH CHECK (
    ((client_id IS NOT NULL) AND private.is_partner_for_client((SELECT auth.uid()), client_id))
    OR ((client_product_id IS NOT NULL) AND (client_product_id IN (
      SELECT cp.id FROM public.client_products cp
      WHERE private.is_partner_for_client((SELECT auth.uid()), cp.client_id)
    )))
  );
