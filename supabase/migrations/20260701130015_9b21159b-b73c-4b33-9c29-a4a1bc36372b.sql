
-- Helper: is this user the assigned service provider for the client_product?
CREATE OR REPLACE FUNCTION public.is_assigned_provider(_user_id uuid, _cp_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_products cp
    JOIN public.service_providers sp ON sp.id = cp.service_provider_id
    WHERE cp.id = _cp_id AND sp.user_id = _user_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_assigned_provider(uuid,uuid) TO authenticated, service_role;

-- Consolidated INSERT policy that overrides individual per-role ones
DROP POLICY IF EXISTS "Providers can insert comments to assigned demands" ON public.demand_comments;
DROP POLICY IF EXISTS "Delegated providers can insert demand comments" ON public.demand_comments;
DROP POLICY IF EXISTS "Shared providers can insert demand comments" ON public.demand_comments;
DROP POLICY IF EXISTS "Partners can insert comments to related demands" ON public.demand_comments;
DROP POLICY IF EXISTS "Clients can insert comments to their demands" ON public.demand_comments;
DROP POLICY IF EXISTS "Authenticated can insert demand comments" ON public.demand_comments;

CREATE POLICY "Authenticated can insert demand comments"
ON public.demand_comments FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_admin(auth.uid())
    OR (
      visibility IN ('provider','client','internal','admin')
      AND (
        public.is_assigned_provider(auth.uid(), client_product_id)
        OR public.is_delegated_provider(auth.uid(), client_product_id)
        OR public.provider_has_demand_access(auth.uid(), client_product_id)
      )
    )
    OR (
      visibility IN ('client','provider')
      AND EXISTS (
        SELECT 1 FROM public.client_products cp
        JOIN public.clients c ON c.id = cp.client_id
        WHERE cp.id = client_product_id AND c.user_id = auth.uid()
      )
    )
  )
);
