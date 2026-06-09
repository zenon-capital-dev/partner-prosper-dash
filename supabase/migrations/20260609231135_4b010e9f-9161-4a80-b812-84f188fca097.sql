
CREATE POLICY "Admins manage all partner-materials"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'partner-materials' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'partner-materials' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read partner-materials"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'partner-materials');
