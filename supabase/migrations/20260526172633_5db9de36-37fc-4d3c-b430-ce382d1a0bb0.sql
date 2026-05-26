-- Add columns to documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.service_providers(id);

-- Add columns to document_requests
ALTER TABLE public.document_requests ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.document_requests ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.service_providers(id);

-- Add columns to demand_deliveries
ALTER TABLE public.demand_deliveries ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.demand_deliveries ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.service_providers(id);

-- Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_collaborator_id ON public.documents(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_documents_provider_id ON public.documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_collaborator_id ON public.document_requests(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_provider_id ON public.document_requests(provider_id);
