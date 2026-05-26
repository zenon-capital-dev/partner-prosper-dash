DROP POLICY IF EXISTS "Authenticated read active templates" ON public.contract_templates;
CREATE POLICY "Internal roles read contract templates"
ON public.contract_templates
FOR SELECT
TO authenticated
USING (
  active = true AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_secondary'::public.app_role)
    OR public.has_role(auth.uid(), 'vendedor'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Authenticated read templates" ON public.message_templates;
CREATE POLICY "Internal roles read message templates"
ON public.message_templates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_secondary'::public.app_role)
  OR public.has_role(auth.uid(), 'vendedor'::public.app_role)
  OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
);