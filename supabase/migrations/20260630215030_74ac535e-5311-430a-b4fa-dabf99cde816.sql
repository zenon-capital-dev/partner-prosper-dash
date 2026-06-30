DROP POLICY IF EXISTS "Partners read own partner contract files" ON storage.objects;

CREATE POLICY "Partners read own partner contract files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-contracts'
  AND EXISTS (
    SELECT 1
    FROM public.partner_contracts pc
    JOIN public.partners p ON p.id = pc.partner_id
    WHERE (
      pc.contract_template_path = storage.objects.name
      OR pc.nda_template_path = storage.objects.name
      OR pc.contract_signed_path = storage.objects.name
      OR pc.nda_signed_path = storage.objects.name
    )
    AND (
      p.user_id = (SELECT auth.uid())
      OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email'))
    )
  )
);