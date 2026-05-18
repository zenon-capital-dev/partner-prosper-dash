CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON public.document_versions(document_id, version_number DESC);

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal team manages document versions"
  ON public.document_versions FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(),'vendedor'::app_role) OR private.has_role(auth.uid(),'colaborador'::app_role))
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(),'vendedor'::app_role) OR private.has_role(auth.uid(),'colaborador'::app_role));

CREATE POLICY "Clients view their document versions"
  ON public.document_versions FOR SELECT TO authenticated
  USING (document_id IN (
    SELECT d.id FROM public.documents d
    JOIN public.clients c ON c.id = d.client_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY "Providers view delegated document versions"
  ON public.document_versions FOR SELECT TO authenticated
  USING (document_id IN (
    SELECT d.id FROM public.documents d
    WHERE d.client_product_id IS NOT NULL
      AND private.is_delegated_provider(auth.uid(), d.client_product_id)
  ));