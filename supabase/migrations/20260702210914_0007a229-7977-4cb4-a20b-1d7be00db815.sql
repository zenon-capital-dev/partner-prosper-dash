
-- 1. client_stage_history: remove "always true" policies, restrict to internal staff
DROP POLICY IF EXISTS "Auth users insert stage history" ON public.client_stage_history;
DROP POLICY IF EXISTS "Auth users read stage history" ON public.client_stage_history;

CREATE POLICY "Staff read stage history"
  ON public.client_stage_history
  FOR SELECT
  TO authenticated
  USING (
    private.is_admin((SELECT auth.uid()))
    OR private.has_role((SELECT auth.uid()), 'vendedor'::app_role)
  );

CREATE POLICY "Staff insert stage history"
  ON public.client_stage_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_admin((SELECT auth.uid()))
    OR private.has_role((SELECT auth.uid()), 'vendedor'::app_role)
  );

-- 2. documents.is_public default -> false (RLS remains the source of truth)
ALTER TABLE public.documents ALTER COLUMN is_public SET DEFAULT false;

-- 3. partners: drop broad colaborador read
DROP POLICY IF EXISTS "Colaboradores view partners" ON public.partners;

-- 4. service_providers: tighten "Staff can view service providers" to admin+vendedor only
DROP POLICY IF EXISTS "Staff can view service providers" ON public.service_providers;

CREATE POLICY "Admins and vendors view service providers"
  ON public.service_providers
  FOR SELECT
  TO authenticated
  USING (
    private.is_admin((SELECT auth.uid()))
    OR private.has_role((SELECT auth.uid()), 'vendedor'::app_role)
  );
