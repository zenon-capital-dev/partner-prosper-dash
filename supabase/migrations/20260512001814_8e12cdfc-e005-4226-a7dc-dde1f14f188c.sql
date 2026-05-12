-- Harden is_delegated_provider: remove email fallback
CREATE OR REPLACE FUNCTION public.is_delegated_provider(_user_id uuid, _client_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.service_providers sp ON sp.id = cp.service_provider_id
    WHERE cp.id = _client_product_id
      AND sp.user_id = _user_id
  );
$$;

-- Same for private schema copy (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'is_delegated_provider'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION private.is_delegated_provider(_user_id uuid, _client_product_id uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE SECURITY DEFINER
      SET search_path TO 'public'
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.client_products cp
          JOIN public.service_providers sp ON sp.id = cp.service_provider_id
          WHERE cp.id = _client_product_id
            AND sp.user_id = _user_id
        );
      $body$;
    $f$;
  END IF;
END $$;

-- Tighten notes INSERT
DROP POLICY IF EXISTS "Users can insert notes" ON public.notes;
DROP POLICY IF EXISTS "Insert notes" ON public.notes;
DROP POLICY IF EXISTS "Authenticated insert notes" ON public.notes;
DROP POLICY IF EXISTS "notes insert" ON public.notes;

CREATE POLICY "notes insert scoped"
ON public.notes FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
    OR (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = notes.client_id AND c.user_id = auth.uid()
    ))
    OR (contract_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.contracts ct JOIN public.clients c ON c.id = ct.client_id
      WHERE ct.id = notes.contract_id AND c.user_id = auth.uid()
    ))
    OR (client_product_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.client_products cp JOIN public.clients c ON c.id = cp.client_id
        WHERE cp.id = notes.client_product_id AND c.user_id = auth.uid()
      )
      OR private.is_delegated_provider(auth.uid(), notes.client_product_id)
    ))
  )
);