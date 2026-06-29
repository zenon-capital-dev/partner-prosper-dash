CREATE OR REPLACE FUNCTION private.is_partner_for_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.partners p ON p.id = c.partner_id
    WHERE c.id = _client_id
      AND (p.user_id = _user_id OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  )
  OR EXISTS (
    SELECT 1
    FROM public.client_partners cp
    JOIN public.partners p ON p.id = cp.partner_id
    WHERE cp.client_id = _client_id
      AND (p.user_id = _user_id OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_involved_in_demand(_user_id uuid, _client_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.client_products cp
    LEFT JOIN public.clients c ON c.id = cp.client_id
    LEFT JOIN public.partners p ON p.id = c.partner_id
    LEFT JOIN public.service_providers sp ON sp.id = cp.service_provider_id
    WHERE cp.id = _client_product_id
      AND (
        c.user_id = _user_id
        OR p.user_id = _user_id
        OR lower(p.email) = lower(auth.jwt() ->> 'email')
        OR sp.user_id = _user_id
        OR lower(sp.email) = lower(auth.jwt() ->> 'email')
        OR cp.responsible_employee_id = _user_id
        OR private.is_partner_for_client(_user_id, cp.client_id)
        OR private.is_delegated_provider(_user_id, cp.id)
      )
  ) OR public.provider_has_demand_access(_user_id, _client_product_id)
$function$;

DROP POLICY IF EXISTS "Partner views own" ON public.partners;
DROP POLICY IF EXISTS "Partners view own record" ON public.partners;
DROP POLICY IF EXISTS "Partners update own record" ON public.partners;

CREATE POLICY "Partners view own record"
ON public.partners
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR lower(email) = lower(auth.jwt() ->> 'email')
);

CREATE POLICY "Partners update own record"
ON public.partners
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR lower(email) = lower(auth.jwt() ->> 'email')
)
WITH CHECK (
  user_id = auth.uid()
  OR lower(email) = lower(auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "Partners view related client document requests" ON public.client_document_requests;
DROP POLICY IF EXISTS "Partners update related client document requests" ON public.client_document_requests;

CREATE POLICY "Partners view related client document requests"
ON public.client_document_requests
FOR SELECT
TO authenticated
USING (
  private.is_partner_for_client(auth.uid(), client_id)
);

CREATE POLICY "Partners update related client document requests"
ON public.client_document_requests
FOR UPDATE
TO authenticated
USING (
  private.is_partner_for_client(auth.uid(), client_id)
)
WITH CHECK (
  private.is_partner_for_client(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Partners view related document requests" ON public.document_requests;
DROP POLICY IF EXISTS "Partners update related document requests" ON public.document_requests;

CREATE POLICY "Partners view related document requests"
ON public.document_requests
FOR SELECT
TO authenticated
USING (
  (client_product_id IS NOT NULL AND public.user_involved_in_demand(auth.uid(), client_product_id))
  OR private.is_partner_for_client(auth.uid(), client_id)
);

CREATE POLICY "Partners update related document requests"
ON public.document_requests
FOR UPDATE
TO authenticated
USING (
  (client_product_id IS NOT NULL AND public.user_involved_in_demand(auth.uid(), client_product_id))
  OR private.is_partner_for_client(auth.uid(), client_id)
)
WITH CHECK (
  (client_product_id IS NOT NULL AND public.user_involved_in_demand(auth.uid(), client_product_id))
  OR private.is_partner_for_client(auth.uid(), client_id)
);