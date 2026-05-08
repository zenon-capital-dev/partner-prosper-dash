-- Fix RLS on document_requests: client_id refers to clients.id, not auth.uid()
DROP POLICY IF EXISTS "Clients can view their own document requests" ON public.document_requests;
DROP POLICY IF EXISTS "Clients can update their own document requests" ON public.document_requests;

CREATE POLICY "Client views own document requests"
ON public.document_requests
FOR SELECT
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Client updates own document requests"
ON public.document_requests
FOR UPDATE
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Storage policies so clients can upload their docs into the 'documents' bucket under their client.id folder
DROP POLICY IF EXISTS "Clients upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Clients read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage all documents" ON storage.objects;

CREATE POLICY "Clients upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.clients WHERE user_id = auth.uid())
);

CREATE POLICY "Clients read own documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.clients WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'vendedor'::app_role)
  )
);

CREATE POLICY "Admins manage all documents"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'documents' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::app_role)))
WITH CHECK (bucket_id = 'documents' AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::app_role)));