
CREATE POLICY "Partners upload own signed contract files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'partner-contracts'
    AND EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (p.user_id = (SELECT auth.uid())
          OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
    )
  );
