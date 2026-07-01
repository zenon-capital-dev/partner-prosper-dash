-- 1) Folders table
CREATE TABLE public.client_document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cdf_client ON public.client_document_folders(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_document_folders TO authenticated;
GRANT ALL ON public.client_document_folders TO service_role;
ALTER TABLE public.client_document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage folders"
  ON public.client_document_folders FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "client sees own folders"
  ON public.client_document_folders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_document_folders.client_id AND c.user_id = auth.uid()));

-- 2) Provider authorization per folder
CREATE TABLE public.client_document_folder_providers (
  folder_id uuid NOT NULL REFERENCES public.client_document_folders(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_id, provider_id)
);
CREATE INDEX idx_cdfp_provider ON public.client_document_folder_providers(provider_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_document_folder_providers TO authenticated;
GRANT ALL ON public.client_document_folder_providers TO service_role;
ALTER TABLE public.client_document_folder_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage folder providers"
  ON public.client_document_folder_providers FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "provider sees own auth"
  ON public.client_document_folder_providers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.id = client_document_folder_providers.provider_id AND sp.user_id = auth.uid()));

-- Extend folders SELECT to authorized providers
CREATE POLICY "authorized providers see folder"
  ON public.client_document_folders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_document_folder_providers p
    JOIN public.service_providers sp ON sp.id = p.provider_id
    WHERE p.folder_id = client_document_folders.id AND sp.user_id = auth.uid()
  ));

-- 3) Link documents to a folder
ALTER TABLE public.documents ADD COLUMN folder_id uuid REFERENCES public.client_document_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_documents_folder ON public.documents(folder_id) WHERE folder_id IS NOT NULL;

-- Additional policies for folder-scoped documents
CREATE POLICY "client uploads in own folder"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (
    folder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.client_document_folders f
      JOIN public.clients c ON c.id = f.client_id
      WHERE f.id = documents.folder_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "client reads folder docs"
  ON public.documents FOR SELECT TO authenticated
  USING (
    folder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.client_document_folders f
      JOIN public.clients c ON c.id = f.client_id
      WHERE f.id = documents.folder_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "authorized provider reads folder docs"
  ON public.documents FOR SELECT TO authenticated
  USING (
    folder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.client_document_folder_providers p
      JOIN public.service_providers sp ON sp.id = p.provider_id
      WHERE p.folder_id = documents.folder_id AND sp.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER trg_cdf_updated BEFORE UPDATE ON public.client_document_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();