-- 1. Create the new enum type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status_new') THEN
        CREATE TYPE document_status_new AS ENUM (
            'solicitado', 
            'enviado', 
            'em_analise', 
            'aprovado', 
            'reprovado', 
            'pendente_correcao', 
            'vencido'
        );
    END IF;
END $$;

-- 2. Add new columns
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- 3. Update status column
-- Drop default first
ALTER TABLE public.documents ALTER COLUMN status DROP DEFAULT;

-- Change to TEXT temporarily to map values
ALTER TABLE public.documents ALTER COLUMN status TYPE TEXT;

UPDATE public.documents SET status = 'reprovado' WHERE status = 'rejeitado';
UPDATE public.documents SET status = 'solicitado' WHERE status NOT IN ('solicitado', 'enviado', 'em_analise', 'aprovado', 'reprovado', 'pendente_correcao', 'vencido');

-- Change to the new enum type
ALTER TABLE public.documents 
ALTER COLUMN status TYPE document_status_new 
USING (status::document_status_new);

-- Set new default
ALTER TABLE public.documents ALTER COLUMN status SET DEFAULT 'solicitado'::document_status_new;

-- 4. Storage Bucket and Policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if any to avoid errors during re-run
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all documents" ON storage.objects;

CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Admins can manage all documents"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'documents');
