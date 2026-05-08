
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_service_providers_user ON public.service_providers(user_id);

-- Recreate is_delegated_provider to use service_providers
CREATE OR REPLACE FUNCTION public.is_delegated_provider(_user_id UUID, _client_product_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.service_providers sp ON sp.id = cp.service_provider_id
    LEFT JOIN auth.users u ON u.id = _user_id
    WHERE cp.id = _client_product_id
      AND (
        sp.user_id = _user_id
        OR (sp.email IS NOT NULL AND u.email IS NOT NULL AND lower(sp.email) = lower(u.email))
      )
  );
$$;
