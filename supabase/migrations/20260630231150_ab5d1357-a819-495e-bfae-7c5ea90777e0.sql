
-- Restrict audit_logs insert to authenticated only and require user_id = auth.uid()
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

-- Remove blanket-true SELECT on products; keep role-scoped policy
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
