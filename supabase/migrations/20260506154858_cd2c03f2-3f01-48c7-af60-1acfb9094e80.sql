
-- Policies para o bucket 'documents'
CREATE POLICY "Admin/vendedor read all documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role)));

CREATE POLICY "Admin/vendedor write all documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role)));

CREATE POLICY "Admin/vendedor update all documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role)));

CREATE POLICY "Admin/vendedor delete all documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role)));

CREATE POLICY "Client reads own folder"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM clients WHERE user_id = auth.uid())
);

CREATE POLICY "Client uploads to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM clients WHERE user_id = auth.uid())
);
