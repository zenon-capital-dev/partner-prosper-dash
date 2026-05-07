-- Expand document_requests table
ALTER TABLE public.document_requests 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS observations TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS submission_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP WITH TIME ZONE;

-- Ensure status has a default
ALTER TABLE public.document_requests ALTER COLUMN status SET DEFAULT 'solicitado';

-- Enable activity logging for this table too
DROP TRIGGER IF EXISTS log_doc_requests_activity ON public.document_requests;
CREATE TRIGGER log_doc_requests_activity AFTER INSERT OR UPDATE OR DELETE ON public.document_requests FOR EACH ROW EXECUTE FUNCTION public.log_activity();
