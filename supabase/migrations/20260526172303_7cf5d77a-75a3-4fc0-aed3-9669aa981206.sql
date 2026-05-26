-- Add priority column to documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'media';

-- Add priority column to document_requests
ALTER TABLE public.document_requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'media';

-- Add priority column to client_document_requests
ALTER TABLE public.client_document_requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'media';

COMMENT ON COLUMN public.documents.priority IS 'Priority of the document request: baixa, media, alta, urgente';
COMMENT ON COLUMN public.document_requests.priority IS 'Priority of the document request: baixa, media, alta, urgente';
COMMENT ON COLUMN public.client_document_requests.priority IS 'Priority of the document request: baixa, media, alta, urgente';