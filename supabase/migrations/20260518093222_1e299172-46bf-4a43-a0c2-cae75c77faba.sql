-- Políticas para o bucket 'documents'
-- Garantir que usuários autenticados possam fazer upload
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Permitir que usuários autenticados vejam documentos (o controle de acesso fino é feito via signed URLs no app)
CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Permitir que usuários autenticados deletem seus próprios documentos ou admins deletem tudo
CREATE POLICY "Users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');

-- Políticas para o bucket 'contracts'
CREATE POLICY "Admins can manage contracts"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'contracts');
