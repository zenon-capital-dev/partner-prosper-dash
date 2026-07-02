
-- 1) Fix leads_colaborador_full_visibility: drop broad policy
DROP POLICY IF EXISTS "Colaboradores view leads" ON public.leads;

-- 2) Fix commission_rules admin check to use is_admin() helper
DROP POLICY IF EXISTS "Admins can manage commission rules" ON public.commission_rules;
CREATE POLICY "Admins can manage commission rules"
ON public.commission_rules
FOR ALL
TO authenticated
USING (private.is_admin((SELECT auth.uid())))
WITH CHECK (private.is_admin((SELECT auth.uid())));

-- 3) Fix SUPA_anon_security_definer_function_executable: revoke anon EXECUTE
REVOKE EXECUTE ON FUNCTION public.sync_commissions_for_payment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_payments_sync_commissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_commissions_for_payment(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_payments_sync_commissions() TO service_role;
