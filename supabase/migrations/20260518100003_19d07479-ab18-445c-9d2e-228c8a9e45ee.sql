
-- Parceiros podem ler arquivos de contratos onde são o partner_id
CREATE POLICY "Partners read own contract files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.partners p ON p.id = c.partner_id
    WHERE c.file_path = storage.objects.name
      AND p.user_id = auth.uid()
  )
);

-- Prestadores podem ler arquivos de contratos vinculados a eles diretamente ou via demanda delegada
CREATE POLICY "Providers read own contract files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts'
  AND (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.service_providers sp ON sp.id = c.provider_id
      WHERE c.file_path = storage.objects.name
        AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.client_products cp ON cp.id = c.client_product_id
      JOIN public.service_providers sp ON sp.id = cp.service_provider_id
      WHERE c.file_path = storage.objects.name
        AND sp.user_id = auth.uid()
    )
  )
);
