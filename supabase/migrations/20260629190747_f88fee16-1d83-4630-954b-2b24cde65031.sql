DROP POLICY IF EXISTS "Partners upload related demand files" ON storage.objects;

CREATE POLICY "Partners upload related demand files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND CASE
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (
        EXISTS (
          SELECT 1
          FROM public.client_products cp
          WHERE cp.id = ((storage.foldername(name))[1])::uuid
            AND private.is_partner_for_client(auth.uid(), cp.client_id)
        )
        OR private.is_partner_for_client(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    ELSE false
  END
);