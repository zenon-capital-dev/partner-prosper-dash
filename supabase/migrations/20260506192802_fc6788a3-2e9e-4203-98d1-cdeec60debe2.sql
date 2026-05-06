-- Add address and referral details to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip_code TEXT,
ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES public.profiles(id);

-- Create table for document requests if it doesn't exist
CREATE TABLE IF NOT EXISTS public.document_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  file_url TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

-- Policies for document_requests using user_roles table
CREATE POLICY "Admins can do everything with document requests" 
ON public.document_requests 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role::text = 'admin'
  )
);

CREATE POLICY "Clients can view their own document requests" 
ON public.document_requests 
FOR SELECT 
USING (client_id = auth.uid());

CREATE POLICY "Clients can update their own document requests" 
-- We specify update so they can change status to 'submitted' and add file_url
ON public.document_requests 
FOR UPDATE 
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());

-- Trigger for updated_at (assuming update_updated_at_column exists from previous sessions)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_document_requests_updated_at
        BEFORE UPDATE ON public.document_requests
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
