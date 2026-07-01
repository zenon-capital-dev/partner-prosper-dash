
-- Allow providers with delegated/shared access to insert & view demand comments
DROP POLICY IF EXISTS "Shared providers can insert demand comments" ON public.demand_comments;
CREATE POLICY "Shared providers can insert demand comments"
ON public.demand_comments FOR INSERT TO authenticated
WITH CHECK (
  visibility = ANY (ARRAY['provider'::comment_visibility, 'client'::comment_visibility])
  AND public.provider_has_demand_access(auth.uid(), client_product_id)
);

DROP POLICY IF EXISTS "Shared providers can view demand comments" ON public.demand_comments;
CREATE POLICY "Shared providers can view demand comments"
ON public.demand_comments FOR SELECT TO authenticated
USING (
  visibility = ANY (ARRAY['provider'::comment_visibility, 'client'::comment_visibility, 'system'::comment_visibility])
  AND public.provider_has_demand_access(auth.uid(), client_product_id)
);

DROP POLICY IF EXISTS "Delegated providers can insert demand comments" ON public.demand_comments;
CREATE POLICY "Delegated providers can insert demand comments"
ON public.demand_comments FOR INSERT TO authenticated
WITH CHECK (
  visibility = ANY (ARRAY['provider'::comment_visibility, 'client'::comment_visibility])
  AND public.is_delegated_provider(auth.uid(), client_product_id)
);

DROP POLICY IF EXISTS "Delegated providers can view demand comments" ON public.demand_comments;
CREATE POLICY "Delegated providers can view demand comments"
ON public.demand_comments FOR SELECT TO authenticated
USING (
  visibility = ANY (ARRAY['provider'::comment_visibility, 'client'::comment_visibility, 'system'::comment_visibility])
  AND public.is_delegated_provider(auth.uid(), client_product_id)
);
