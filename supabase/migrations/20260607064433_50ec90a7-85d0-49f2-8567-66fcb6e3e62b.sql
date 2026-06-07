CREATE INDEX IF NOT EXISTS idx_client_product_steps_product_position
ON public.client_product_steps (client_product_id, position);

CREATE INDEX IF NOT EXISTS idx_client_product_steps_visible_product
ON public.client_product_steps (client_product_id, is_visible_to_client);

CREATE INDEX IF NOT EXISTS idx_cpsr_product_created
ON public.client_product_status_reports (client_product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_providers_client_provider
ON public.client_providers (client_id, service_provider_id);

CREATE INDEX IF NOT EXISTS idx_client_product_providers_product_provider
ON public.client_product_providers (client_product_id, service_provider_id);

DROP POLICY IF EXISTS "Admins can do everything on steps" ON public.client_product_steps;
DROP POLICY IF EXISTS "Clients can toggle own product steps" ON public.client_product_steps;
DROP POLICY IF EXISTS "Clients can view visible product steps" ON public.client_product_steps;
DROP POLICY IF EXISTS "Internal team manages client product steps" ON public.client_product_steps;
DROP POLICY IF EXISTS "Partners view visible product steps" ON public.client_product_steps;
DROP POLICY IF EXISTS "Providers manage delegated product steps" ON public.client_product_steps;
DROP POLICY IF EXISTS "Referrers view visible product steps" ON public.client_product_steps;

CREATE POLICY "Internal team manages client product steps"
ON public.client_product_steps
FOR ALL
TO authenticated
USING (
  (SELECT private.is_admin(auth.uid()))
  OR (SELECT private.has_role(auth.uid(), 'vendedor'::public.app_role))
  OR (SELECT private.has_role(auth.uid(), 'colaborador'::public.app_role))
)
WITH CHECK (
  (SELECT private.is_admin(auth.uid()))
  OR (SELECT private.has_role(auth.uid(), 'vendedor'::public.app_role))
  OR (SELECT private.has_role(auth.uid(), 'colaborador'::public.app_role))
);

CREATE POLICY "Clients view visible own product steps"
ON public.client_product_steps
FOR SELECT
TO authenticated
USING (
  is_visible_to_client = true
  AND EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE cp.id = client_product_steps.client_product_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Clients update visible own product steps"
ON public.client_product_steps
FOR UPDATE
TO authenticated
USING (
  is_visible_to_client = true
  AND EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE cp.id = client_product_steps.client_product_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  is_visible_to_client = true
  AND EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE cp.id = client_product_steps.client_product_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Providers manage delegated product steps"
ON public.client_product_steps
FOR ALL
TO authenticated
USING ((SELECT private.is_delegated_provider(auth.uid(), client_product_id)))
WITH CHECK ((SELECT private.is_delegated_provider(auth.uid(), client_product_id)));

CREATE POLICY "Partners view visible product steps"
ON public.client_product_steps
FOR SELECT
TO authenticated
USING (
  is_visible_to_client = true
  AND EXISTS (
    SELECT 1
    FROM public.client_products cp
    WHERE cp.id = client_product_steps.client_product_id
      AND private.is_partner_for_client(auth.uid(), cp.client_id)
  )
);

CREATE POLICY "Referrers view visible product steps"
ON public.client_product_steps
FOR SELECT
TO authenticated
USING (
  is_visible_to_client = true
  AND EXISTS (
    SELECT 1
    FROM public.client_products cp
    WHERE cp.id = client_product_steps.client_product_id
      AND private.is_referrer_for_client(auth.uid(), cp.client_id)
  )
);

DROP POLICY IF EXISTS "Admins manage status reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Clients see their product reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Collaborators view related status reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Partners view related status reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Providers create own status reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Providers delete own status reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Providers update own status reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Providers view delegated status reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Referrers view related status reports" ON public.client_product_status_reports;

CREATE POLICY "Internal team manages status reports"
ON public.client_product_status_reports
FOR ALL
TO authenticated
USING (
  (SELECT private.is_admin(auth.uid()))
  OR (SELECT private.has_role(auth.uid(), 'vendedor'::public.app_role))
  OR (SELECT private.has_role(auth.uid(), 'colaborador'::public.app_role))
)
WITH CHECK (
  (SELECT private.is_admin(auth.uid()))
  OR (SELECT private.has_role(auth.uid(), 'vendedor'::public.app_role))
  OR (SELECT private.has_role(auth.uid(), 'colaborador'::public.app_role))
);

CREATE POLICY "Clients view own status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE cp.id = client_product_status_reports.client_product_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Providers view delegated status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING ((SELECT private.is_delegated_provider(auth.uid(), client_product_id)));

CREATE POLICY "Providers create own status reports"
ON public.client_product_status_reports
FOR INSERT
TO authenticated
WITH CHECK ((SELECT private.is_delegated_provider(auth.uid(), client_product_id)) AND reported_by = auth.uid());

CREATE POLICY "Providers update own status reports"
ON public.client_product_status_reports
FOR UPDATE
TO authenticated
USING ((SELECT private.is_delegated_provider(auth.uid(), client_product_id)) AND reported_by = auth.uid())
WITH CHECK ((SELECT private.is_delegated_provider(auth.uid(), client_product_id)) AND reported_by = auth.uid());

CREATE POLICY "Providers delete own status reports"
ON public.client_product_status_reports
FOR DELETE
TO authenticated
USING ((SELECT private.is_delegated_provider(auth.uid(), client_product_id)) AND reported_by = auth.uid());

CREATE POLICY "Partners view related status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_products cp
    WHERE cp.id = client_product_status_reports.client_product_id
      AND private.is_partner_for_client(auth.uid(), cp.client_id)
  )
);

CREATE POLICY "Referrers view related status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_products cp
    WHERE cp.id = client_product_status_reports.client_product_id
      AND private.is_referrer_for_client(auth.uid(), cp.client_id)
  )
);

CREATE POLICY "Collaborators view related status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING ((SELECT private.is_collaborator_for_client_product(auth.uid(), client_product_id)));