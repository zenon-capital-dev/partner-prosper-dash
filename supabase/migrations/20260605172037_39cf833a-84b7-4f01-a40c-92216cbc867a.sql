CREATE OR REPLACE FUNCTION private.is_secondary_provider_for_client_product(_user_id uuid, _client_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_product_providers cpp
    JOIN public.service_providers sp ON sp.id = cpp.service_provider_id
    WHERE cpp.client_product_id = _client_product_id
      AND (
        sp.user_id = _user_id
        OR lower(sp.email) = lower(auth.jwt() ->> 'email')
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.is_delegated_provider(_user_id uuid, _client_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.service_providers sp
      ON sp.id = cp.service_provider_id OR sp.id = cp.responsible_provider_id
    WHERE cp.id = _client_product_id
      AND (
        sp.user_id = _user_id
        OR lower(sp.email) = lower(auth.jwt() ->> 'email')
      )
  )
  OR private.is_secondary_provider_for_client_product(_user_id, _client_product_id);
$$;

DROP POLICY IF EXISTS "Secondary providers view assigned demands" ON public.client_products;
CREATE POLICY "Secondary providers view assigned demands"
ON public.client_products
FOR SELECT
TO authenticated
USING (private.is_secondary_provider_for_client_product(auth.uid(), id));

DROP POLICY IF EXISTS "Collaborators view providers of their demands" ON public.client_product_providers;
CREATE POLICY "Collaborators view providers of their demands"
ON public.client_product_providers
FOR SELECT
TO authenticated
USING (private.is_collaborator_for_client_product(auth.uid(), client_product_id));