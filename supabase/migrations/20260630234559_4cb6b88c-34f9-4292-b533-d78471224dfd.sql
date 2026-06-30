
-- Allow partners to view and insert version history for their own documents
CREATE POLICY "Partners view own document versions"
ON public.document_versions
FOR SELECT
USING (
  document_id IN (
    SELECT d.id FROM public.documents d
    JOIN public.partners p ON p.id = d.partner_id
    WHERE d.partner_id IS NOT NULL
      AND (p.user_id = (SELECT auth.uid()) OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
  )
);

CREATE POLICY "Partners insert own document versions"
ON public.document_versions
FOR INSERT
WITH CHECK (
  document_id IN (
    SELECT d.id FROM public.documents d
    JOIN public.partners p ON p.id = d.partner_id
    WHERE d.partner_id IS NOT NULL
      AND (p.user_id = (SELECT auth.uid()) OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
  )
);
