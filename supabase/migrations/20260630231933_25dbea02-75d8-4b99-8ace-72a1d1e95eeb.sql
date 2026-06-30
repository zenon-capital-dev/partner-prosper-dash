CREATE POLICY "Partners update own support tickets"
ON public.partner_support_tickets FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_support_tickets.partner_id
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(((auth.jwt()) ->> 'email')))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_support_tickets.partner_id
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(((auth.jwt()) ->> 'email')))
  )
);