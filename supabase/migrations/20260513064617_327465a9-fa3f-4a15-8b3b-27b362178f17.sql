DROP POLICY IF EXISTS "Partners access their referrals" ON public.client_products;

CREATE POLICY "Partners access their referred client products"
ON public.client_products
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id
    FROM public.clients c
    WHERE c.partner_id IN (
      SELECT p.id
      FROM public.partners p
      WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Referrers view their referred clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  referrer_id IN (
    SELECT r.id
    FROM public.referrers r
    WHERE r.user_id = auth.uid()
       OR lower(r.email) = lower((auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "Referrers view referred client products"
ON public.client_products
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT c.id
    FROM public.clients c
    WHERE c.referrer_id IN (
      SELECT r.id
      FROM public.referrers r
      WHERE r.user_id = auth.uid()
         OR lower(r.email) = lower((auth.jwt() ->> 'email'))
    )
  )
);

CREATE POLICY "Referrers view own sales"
ON public.sales
FOR SELECT
TO authenticated
USING (
  referrer_id IN (
    SELECT r.id
    FROM public.referrers r
    WHERE r.user_id = auth.uid()
       OR lower(r.email) = lower((auth.jwt() ->> 'email'))
  )
);