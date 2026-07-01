DROP POLICY IF EXISTS "product-docs insert" ON storage.objects;
DROP POLICY IF EXISTS "product-docs read" ON storage.objects;

CREATE POLICY "product-docs insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-documents'
  AND ((string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  AND public.can_access_product_folder(((string_to_array(name, '/'))[2])::uuid, auth.uid())
);

CREATE POLICY "product-docs read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-documents'
  AND ((string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  AND public.can_access_product_folder(((string_to_array(name, '/'))[2])::uuid, auth.uid())
);