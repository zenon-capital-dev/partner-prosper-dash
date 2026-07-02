ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS phase_label text;

CREATE INDEX IF NOT EXISTS documents_parent_document_id_idx
  ON public.documents(parent_document_id);