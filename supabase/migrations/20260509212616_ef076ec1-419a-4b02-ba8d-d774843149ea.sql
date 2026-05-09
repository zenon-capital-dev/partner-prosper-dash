-- 1. Ensure columns for request tracking
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id);

-- 2. Update status column to support the requested statuses
-- Statuses: solicitado, enviado, em_analise, aprovado, reprovado, pendente_correcao, vencido (atrasado)
-- (We'll map 'atrasado' to 'vencido' for database consistency if needed, or just use the text)

-- 3. RLS for Client Uploading
-- Allow client to UPDATE a document that is in 'solicitado' or 'reprovado' status
DROP POLICY IF EXISTS "Clients can upload requested documents" ON public.documents;
CREATE POLICY "Clients can upload requested documents"
ON public.documents FOR UPDATE
USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  AND (status = 'solicitado' OR status = 'reprovado' OR status = 'pendente_correcao')
)
WITH CHECK (
  status = 'enviado'
);
