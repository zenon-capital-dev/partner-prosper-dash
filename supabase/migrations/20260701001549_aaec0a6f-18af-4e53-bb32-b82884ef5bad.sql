-- Allow clients to create their own ad-hoc document uploads
CREATE POLICY "Client inserts own document requests"
ON public.document_requests
FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.user_id = (SELECT auth.uid()))
);