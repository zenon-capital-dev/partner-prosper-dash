
-- Extend is_delegated_provider to also include providers linked at client level
CREATE OR REPLACE FUNCTION private.is_delegated_provider(_user_id uuid, _client_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  OR private.is_secondary_provider_for_client_product(_user_id, _client_product_id)
  OR EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.client_providers cpv ON cpv.client_id = cp.client_id
    JOIN public.service_providers sp ON sp.id = cpv.service_provider_id
    WHERE cp.id = _client_product_id
      AND (
        sp.user_id = _user_id
        OR lower(sp.email) = lower(auth.jwt() ->> 'email')
      )
  );
$function$;

-- Allow providers to read clients they're linked to (so the panel can display names)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='Providers view linked clients'
  ) THEN
    CREATE POLICY "Providers view linked clients"
      ON public.clients FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.client_providers cpv
          JOIN public.service_providers sp ON sp.id = cpv.service_provider_id
          WHERE cpv.client_id = clients.id
            AND (
              sp.user_id = auth.uid()
              OR lower(sp.email) = lower(auth.jwt() ->> 'email')
            )
        )
      );
  END IF;
END$$;
