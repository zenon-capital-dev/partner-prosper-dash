
-- 1) audit_logs: allow inserts (self-attributed or system/anon login attempts)
CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated, anon
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 2) onboarding_documents: align ownership check with clients.user_id
DROP POLICY IF EXISTS "Onboarding docs: Client view" ON public.onboarding_documents;
DROP POLICY IF EXISTS "Onboarding docs: Client update" ON public.onboarding_documents;

CREATE POLICY "Onboarding docs: Client view"
ON public.onboarding_documents
FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Onboarding docs: Client update"
ON public.onboarding_documents
FOR UPDATE
TO authenticated
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  AND status = ANY (ARRAY['pending'::text, 'rejected'::text])
)
WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
