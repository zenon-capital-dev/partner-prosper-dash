-- 1. Extend documents table for advanced management
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- 2. Ensure indexes for advanced filtering in Documents Center
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_is_required ON public.documents(is_required);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_product_id ON public.documents(product_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_product_id ON public.documents(client_product_id);

-- 3. Update RLS to allow clients to update (resubmit) documents that were rejected
DROP POLICY IF EXISTS "Clients can update rejected documents" ON public.documents;
CREATE POLICY "Clients can update rejected documents"
ON public.documents FOR UPDATE
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  AND status IN ('solicitado', 'reprovado', 'pendente_correcao')
)
WITH CHECK (
  status = 'enviado'
);
