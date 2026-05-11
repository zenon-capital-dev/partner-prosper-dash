-- Resolve latest security scan warnings

-- 1) Status reports: providers may view assigned reports, insert own reports, and only update/delete their own reports.
DROP POLICY IF EXISTS "Service providers can manage their own reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Provider creates own reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Provider views own reports" ON public.client_product_status_reports;
DROP POLICY IF EXISTS "Providers see own reports" ON public.client_product_status_reports;

CREATE POLICY "Providers view delegated status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING (private.is_delegated_provider(auth.uid(), client_product_id));

CREATE POLICY "Providers create own status reports"
ON public.client_product_status_reports
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_delegated_provider(auth.uid(), client_product_id)
  AND reported_by = auth.uid()
);

CREATE POLICY "Providers update own status reports"
ON public.client_product_status_reports
FOR UPDATE
TO authenticated
USING (
  private.is_delegated_provider(auth.uid(), client_product_id)
  AND reported_by = auth.uid()
)
WITH CHECK (
  private.is_delegated_provider(auth.uid(), client_product_id)
  AND reported_by = auth.uid()
);

CREATE POLICY "Providers delete own status reports"
ON public.client_product_status_reports
FOR DELETE
TO authenticated
USING (
  private.is_delegated_provider(auth.uid(), client_product_id)
  AND reported_by = auth.uid()
);

-- 2) Pauses/delays: add scoped read access for participants in the demand.
CREATE POLICY "Participants view related demand delays"
ON public.client_product_delays
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    LEFT JOIN public.partners p ON p.id = c.partner_id
    WHERE cp.id = client_product_delays.client_product_id
      AND (
        private.is_admin(auth.uid())
        OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
        OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
        OR c.user_id = auth.uid()
        OR p.user_id = auth.uid()
        OR private.is_delegated_provider(auth.uid(), cp.id)
      )
  )
);

CREATE POLICY "Participants view related demand pauses"
ON public.client_product_pauses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    LEFT JOIN public.partners p ON p.id = c.partner_id
    WHERE cp.id = client_product_pauses.client_product_id
      AND (
        private.is_admin(auth.uid())
        OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
        OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
        OR c.user_id = auth.uid()
        OR p.user_id = auth.uid()
        OR private.is_delegated_provider(auth.uid(), cp.id)
      )
  )
);