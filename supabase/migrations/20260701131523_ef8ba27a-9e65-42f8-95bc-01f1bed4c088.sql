GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_document_folders TO authenticated;
GRANT ALL ON public.product_document_folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_document_files TO authenticated;
GRANT ALL ON public.product_document_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_comments TO authenticated;
GRANT ALL ON public.demand_comments TO service_role;

CREATE OR REPLACE FUNCTION public.can_access_product_folder(_folder_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.product_document_folders f
    WHERE f.id = _folder_id
      AND (
        public.is_admin(_user_id)
        OR (
          f.scope = 'client'
          AND public.is_client_of_product(f.client_product_id, _user_id)
        )
        OR (
          f.scope = 'client'
          AND f.created_by = _user_id
          AND public.user_involved_in_demand(_user_id, f.client_product_id)
        )
        OR (
          f.scope = 'client'
          AND f.owner_provider_user_id = _user_id
          AND public.user_involved_in_demand(_user_id, f.client_product_id)
        )
        OR (
          f.scope = 'internal'
          AND f.owner_provider_user_id = _user_id
          AND public.user_involved_in_demand(_user_id, f.client_product_id)
        )
      )
  )
$function$;

DROP POLICY IF EXISTS "folders select" ON public.product_document_folders;
DROP POLICY IF EXISTS "folders insert" ON public.product_document_folders;
DROP POLICY IF EXISTS "folders update" ON public.product_document_folders;
DROP POLICY IF EXISTS "folders delete" ON public.product_document_folders;
DROP POLICY IF EXISTS "files select" ON public.product_document_files;
DROP POLICY IF EXISTS "files insert" ON public.product_document_files;
DROP POLICY IF EXISTS "files delete" ON public.product_document_files;

CREATE POLICY "folders select"
ON public.product_document_folders
FOR SELECT
TO authenticated
USING (public.can_access_product_folder(id, auth.uid()));

CREATE POLICY "folders insert"
ON public.product_document_folders
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    scope = 'client'
    AND created_by = auth.uid()
    AND (
      public.is_client_of_product(client_product_id, auth.uid())
      OR public.user_involved_in_demand(auth.uid(), client_product_id)
    )
  )
  OR (
    scope = 'internal'
    AND owner_provider_user_id = auth.uid()
    AND created_by = auth.uid()
    AND public.user_involved_in_demand(auth.uid(), client_product_id)
  )
);

CREATE POLICY "folders update"
ON public.product_document_folders
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "folders delete"
ON public.product_document_folders
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "files select"
ON public.product_document_files
FOR SELECT
TO authenticated
USING (public.can_access_product_folder(folder_id, auth.uid()));

CREATE POLICY "files insert"
ON public.product_document_files
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND public.can_access_product_folder(folder_id, auth.uid())
);

CREATE POLICY "files delete"
ON public.product_document_files
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()) OR uploaded_by = auth.uid());

DROP POLICY IF EXISTS "product-docs insert" ON storage.objects;
DROP POLICY IF EXISTS "product-docs read" ON storage.objects;
DROP POLICY IF EXISTS "product-docs delete" ON storage.objects;

CREATE POLICY "product-docs insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-documents'
  AND public.can_access_product_folder(((string_to_array(name, '/'))[2])::uuid, auth.uid())
);

CREATE POLICY "product-docs read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-documents'
  AND public.can_access_product_folder(((string_to_array(name, '/'))[2])::uuid, auth.uid())
);

CREATE POLICY "product-docs delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-documents'
  AND (
    public.is_admin(auth.uid())
    OR owner = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated can insert demand comments" ON public.demand_comments;
CREATE POLICY "Authenticated can insert demand comments"
ON public.demand_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_admin(auth.uid())
    OR public.user_involved_in_demand(auth.uid(), client_product_id)
  )
);