
-- 1) Revoke EXECUTE on SECURITY DEFINER functions exposed via PostgREST
REVOKE EXECUTE ON FUNCTION public.check_is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_user_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_delegated_provider(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 2) Qualify function refs in policies (avoid search_path hijacking)
ALTER POLICY "Providers view delegated demand tasks" ON public.tasks
  USING ((client_product_id IS NOT NULL) AND public.is_delegated_provider(auth.uid(), client_product_id));

ALTER POLICY "Providers update delegated demand tasks" ON public.tasks
  USING ((client_product_id IS NOT NULL) AND public.is_delegated_provider(auth.uid(), client_product_id))
  WITH CHECK ((client_product_id IS NOT NULL) AND public.is_delegated_provider(auth.uid(), client_product_id));

ALTER POLICY "Admins manage user roles without recursion" ON public.user_roles
  USING (public.check_is_admin(auth.uid()))
  WITH CHECK (public.check_is_admin(auth.uid()));

-- 3) financial_alerts: allow vendedor/colaborador to read & create
CREATE POLICY "Staff view financial alerts"
  ON public.financial_alerts FOR SELECT
  TO authenticated
  USING (
    public.check_is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'vendedor'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

CREATE POLICY "Staff create financial alerts"
  ON public.financial_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'vendedor'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );
