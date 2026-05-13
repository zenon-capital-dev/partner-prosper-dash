
-- 1) tasks: use private.is_delegated_provider
ALTER POLICY "Providers view delegated demand tasks" ON public.tasks
  USING ((client_product_id IS NOT NULL) AND private.is_delegated_provider(auth.uid(), client_product_id));

ALTER POLICY "Providers update delegated demand tasks" ON public.tasks
  USING ((client_product_id IS NOT NULL) AND private.is_delegated_provider(auth.uid(), client_product_id))
  WITH CHECK ((client_product_id IS NOT NULL) AND private.is_delegated_provider(auth.uid(), client_product_id));

-- 2) user_roles: split into per-command policies; only admin can write
DROP POLICY IF EXISTS "Admins manage user roles without recursion" ON public.user_roles;

CREATE POLICY "Admins read all user roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (private.check_is_admin(auth.uid()));

CREATE POLICY "Only admins insert user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (private.check_is_admin(auth.uid()));

CREATE POLICY "Only admins update user roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (private.check_is_admin(auth.uid()))
  WITH CHECK (private.check_is_admin(auth.uid()));

CREATE POLICY "Only admins delete user roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (private.check_is_admin(auth.uid()));

-- 3) financial_alerts: re-create with private.* refs
DROP POLICY IF EXISTS "Staff view financial alerts" ON public.financial_alerts;
DROP POLICY IF EXISTS "Staff create financial alerts" ON public.financial_alerts;

CREATE POLICY "Staff view financial alerts"
  ON public.financial_alerts FOR SELECT
  TO authenticated
  USING (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
    OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

CREATE POLICY "Staff create financial alerts"
  ON public.financial_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
    OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

-- 4) system_settings: restrict reads to admins only (may hold secrets)
DROP POLICY IF EXISTS "Internal team views system settings" ON public.system_settings;

-- 5) notes: drop weak duplicate INSERT policy
DROP POLICY IF EXISTS "Users can create notes" ON public.notes;
DROP POLICY IF EXISTS "Users can see notes they have access to" ON public.notes;

CREATE POLICY "Users see notes they own or are scoped to"
  ON public.notes FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
    OR (
      is_private = false
      AND client_product_id IS NOT NULL
      AND private.is_delegated_provider(auth.uid(), client_product_id)
    )
    OR (
      client_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM clients c WHERE c.id = notes.client_id AND c.user_id = auth.uid())
    )
  );
