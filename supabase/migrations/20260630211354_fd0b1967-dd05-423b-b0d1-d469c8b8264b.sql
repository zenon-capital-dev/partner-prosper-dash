
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_partner_id ON public.documents(partner_id) WHERE partner_id IS NOT NULL;

DROP POLICY IF EXISTS "Partners view own documents" ON public.documents;
CREATE POLICY "Partners view own documents" ON public.documents FOR SELECT
USING (
  partner_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = documents.partner_id
      AND (p.user_id = (SELECT auth.uid()) OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
  )
);

DROP POLICY IF EXISTS "Partners update own documents" ON public.documents;
CREATE POLICY "Partners update own documents" ON public.documents FOR UPDATE
USING (
  partner_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = documents.partner_id
      AND (p.user_id = (SELECT auth.uid()) OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
  )
)
WITH CHECK (
  partner_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = documents.partner_id
      AND (p.user_id = (SELECT auth.uid()) OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
  )
);

DROP POLICY IF EXISTS "Partners read partner materials files" ON storage.objects;
CREATE POLICY "Partners read partner materials files" ON storage.objects FOR SELECT
USING (
  bucket_id = 'partner-materials'
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.user_id = (SELECT auth.uid())
       OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email'))
  )
);

DROP POLICY IF EXISTS "Partners read own document files" ON storage.objects;
CREATE POLICY "Partners read own document files" ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.partners p ON p.id = d.partner_id
    WHERE d.file_path = storage.objects.name
      AND (p.user_id = (SELECT auth.uid()) OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
  )
);

DROP POLICY IF EXISTS "Partners upload own document files" ON storage.objects;
CREATE POLICY "Partners upload own document files" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'partners'
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND (p.user_id = (SELECT auth.uid()) OR lower(p.email) = lower(((SELECT auth.jwt()) ->> 'email')))
  )
);
