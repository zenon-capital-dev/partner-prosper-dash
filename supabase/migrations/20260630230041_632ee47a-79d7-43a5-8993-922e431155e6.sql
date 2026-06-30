CREATE POLICY "Partners can insert comments to related demands"
ON public.demand_comments
FOR INSERT
TO authenticated
WITH CHECK (
  visibility = ANY (ARRAY['client'::comment_visibility, 'provider'::comment_visibility])
  AND client_product_id IN (
    SELECT cp.id FROM public.client_products cp
    WHERE private.is_partner_for_client((SELECT auth.uid()), cp.client_id)
  )
);