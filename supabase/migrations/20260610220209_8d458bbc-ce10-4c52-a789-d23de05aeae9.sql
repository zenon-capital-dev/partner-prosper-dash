DROP POLICY IF EXISTS "Partners manage own partner contracts" ON public.partner_contracts;

CREATE POLICY "Partners view own partner contracts"
ON public.partner_contracts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_contracts.partner_id
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "Partners create own partner contracts"
ON public.partner_contracts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_contracts.partner_id
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  )
  AND status = 'rascunho'
  AND admin_notes IS NULL
  AND contract_signed_path IS NULL
  AND contract_uploaded_at IS NULL
  AND nda_signed_path IS NULL
  AND nda_uploaded_at IS NULL
);

CREATE POLICY "Partners update own partner contract data"
ON public.partner_contracts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_contracts.partner_id
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_contracts.partner_id
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  )
  AND contract_signed_path IS NULL
  AND contract_uploaded_at IS NULL
  AND nda_signed_path IS NULL
  AND nda_uploaded_at IS NULL
);