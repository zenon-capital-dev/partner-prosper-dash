
CREATE TABLE public.product_document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_product_id uuid NOT NULL REFERENCES public.client_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('client','internal')),
  owner_provider_user_id uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pdf_product ON public.product_document_folders(client_product_id);
CREATE INDEX idx_pdf_owner ON public.product_document_folders(owner_provider_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_document_folders TO authenticated;
GRANT ALL ON public.product_document_folders TO service_role;
ALTER TABLE public.product_document_folders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_client_of_product(_client_product_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE cp.id = _client_product_id AND c.user_id = _user_id
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_client_of_product(uuid, uuid) TO authenticated;

CREATE POLICY "folders select" ON public.product_document_folders FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (scope = 'client' AND public.is_client_of_product(client_product_id, auth.uid()))
  OR (scope = 'internal' AND owner_provider_user_id = auth.uid()
      AND public.provider_has_demand_access(client_product_id, auth.uid()))
);
CREATE POLICY "folders insert" ON public.product_document_folders FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR (scope = 'client' AND public.is_client_of_product(client_product_id, auth.uid()) AND created_by = auth.uid())
  OR (scope = 'internal' AND owner_provider_user_id = auth.uid()
      AND public.provider_has_demand_access(client_product_id, auth.uid()) AND created_by = auth.uid())
);
CREATE POLICY "folders update" ON public.product_document_folders FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "folders delete" ON public.product_document_folders FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR created_by = auth.uid());
CREATE TRIGGER trg_pdf_updated_at BEFORE UPDATE ON public.product_document_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.product_document_folders(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pdfiles_folder ON public.product_document_files(folder_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_document_files TO authenticated;
GRANT ALL ON public.product_document_files TO service_role;
ALTER TABLE public.product_document_files ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_product_folder(_folder_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.product_document_folders f
    WHERE f.id = _folder_id
      AND (
        public.is_admin(_user_id)
        OR (f.scope = 'client' AND public.is_client_of_product(f.client_product_id, _user_id))
        OR (f.scope = 'internal' AND f.owner_provider_user_id = _user_id
            AND public.provider_has_demand_access(f.client_product_id, _user_id))
      )
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_access_product_folder(uuid, uuid) TO authenticated;

CREATE POLICY "files select" ON public.product_document_files FOR SELECT TO authenticated
USING (public.can_access_product_folder(folder_id, auth.uid()));
CREATE POLICY "files insert" ON public.product_document_files FOR INSERT TO authenticated
WITH CHECK (public.can_access_product_folder(folder_id, auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "files delete" ON public.product_document_files FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR uploaded_by = auth.uid());

CREATE POLICY "product-docs read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-documents'
  AND public.can_access_product_folder((string_to_array(name,'/'))[2]::uuid, auth.uid()));
CREATE POLICY "product-docs insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-documents'
  AND public.can_access_product_folder((string_to_array(name,'/'))[2]::uuid, auth.uid()));
CREATE POLICY "product-docs delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-documents' AND (public.is_admin(auth.uid()) OR owner = auth.uid()));
