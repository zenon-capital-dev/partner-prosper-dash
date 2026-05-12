-- Partners: only admins see full row (which includes banking). Vendedor loses direct SELECT.
DROP POLICY IF EXISTS "Admins view all partners" ON public.partners;
DROP POLICY IF EXISTS "Vendedor view partners" ON public.partners;

CREATE POLICY "Admins view all partners"
ON public.partners FOR SELECT TO authenticated
USING (private.is_admin(auth.uid()));

-- Partners self-view (their own record)
DROP POLICY IF EXISTS "Partners view own record" ON public.partners;
CREATE POLICY "Partners view own record"
ON public.partners FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Referrers: admin-only SELECT
DROP POLICY IF EXISTS "Admin/vendedor manage referrers" ON public.referrers;
DROP POLICY IF EXISTS "Vendedor view referrers" ON public.referrers;

CREATE POLICY "Admins manage referrers"
ON public.referrers FOR ALL TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

-- Referrer self-view
DROP POLICY IF EXISTS "Referrers view own record" ON public.referrers;
CREATE POLICY "Referrers view own record"
ON public.referrers FOR SELECT TO authenticated
USING (user_id = auth.uid());