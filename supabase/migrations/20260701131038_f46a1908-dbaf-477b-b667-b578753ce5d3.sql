DROP POLICY IF EXISTS "folders insert" ON public.product_document_folders;
CREATE POLICY "folders insert" ON public.product_document_folders
FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid())
  OR (
    scope = 'client'
    AND created_by = auth.uid()
    AND (
      is_client_of_product(client_product_id, auth.uid())
      OR provider_has_demand_access(client_product_id, auth.uid())
    )
  )
  OR (
    scope = 'internal'
    AND owner_provider_user_id = auth.uid()
    AND created_by = auth.uid()
    AND provider_has_demand_access(client_product_id, auth.uid())
  )
);