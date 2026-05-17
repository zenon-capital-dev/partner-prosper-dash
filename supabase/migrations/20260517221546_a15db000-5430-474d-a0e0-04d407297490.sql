-- Dedupe duplicate/conflicting RLS policies

-- activities: keep `Admins total access` (ALL) + user-scoped policies; drop the redundant SELECT
DROP POLICY IF EXISTS "Admins view all activities" ON public.activities;

-- audit_logs: keep `Admins total access` (ALL); drop the two redundant SELECT policies
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- contracts: keep `Admins total access` + `Internal team manages contracts` + client/partner/provider SELECTs; drop duplicates
DROP POLICY IF EXISTS "Admins manage contracts" ON public.contracts;
DROP POLICY IF EXISTS "Clients can view their own contracts" ON public.contracts;
