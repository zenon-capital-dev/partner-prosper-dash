
DROP POLICY IF EXISTS "Admins can manage contracts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated can update own uploads" ON storage.objects;
CREATE POLICY "Authenticated can update own uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      private.is_admin(auth.uid())
      OR (storage.foldername(name))[1] IN (
        SELECT (c.id)::text FROM public.clients c WHERE c.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Onboarding docs: Admin full access" ON public.onboarding_documents;
CREATE POLICY "Onboarding docs: Admin full access"
  ON public.onboarding_documents FOR ALL
  TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
