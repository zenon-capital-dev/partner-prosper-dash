
-- Fix onboarding_history client policy to join via clients table
DROP POLICY IF EXISTS "Onboarding history: Client view" ON public.onboarding_history;
CREATE POLICY "Onboarding history: Client view"
ON public.onboarding_history
FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Revoke broad EXECUTE on admin-only cascade delete (relies on internal is_admin check, but should not be callable by anon)
REVOKE EXECUTE ON FUNCTION public.admin_delete_product_cascade(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_product_cascade(uuid) TO service_role;
