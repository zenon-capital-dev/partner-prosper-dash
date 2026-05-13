CREATE POLICY "Partners create referred clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  partner_id IN (
    SELECT p.id
    FROM public.partners p
    WHERE p.user_id = auth.uid()
       OR lower(p.email) = lower((auth.jwt() ->> 'email'))
  )
  AND (referrer_id IS NULL)
);

CREATE POLICY "Referrers create referred clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  referrer_id IN (
    SELECT r.id
    FROM public.referrers r
    WHERE r.user_id = auth.uid()
       OR lower(r.email) = lower((auth.jwt() ->> 'email'))
  )
  AND (partner_id IS NULL)
);