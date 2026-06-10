DROP POLICY IF EXISTS "Providers upload delegated demand files" ON storage.objects;

CREATE POLICY "Providers upload delegated demand files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND CASE
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.is_delegated_provider(auth.uid(), ((storage.foldername(name))[1])::uuid)
    ELSE false
  END
);