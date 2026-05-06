-- Update leads table structure
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id),
ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS converted_to_client_id UUID REFERENCES public.clients(id),
ADD COLUMN IF NOT EXISTS conversion_date TIMESTAMP WITH TIME ZONE;

-- Create history table for leads
CREATE TABLE IF NOT EXISTS public.lead_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    description TEXT,
    metadata JSONB
);

-- Enable RLS on lead_history
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;

-- Policies for lead_history
CREATE POLICY "Leads history visible to authenticated users" 
ON public.lead_history FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Leads history insertable by authenticated users" 
ON public.lead_history FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Ensure updated_at trigger exists for leads
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_leads_updated_at') THEN
        CREATE TRIGGER update_leads_updated_at
        BEFORE UPDATE ON public.leads
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
EXCEPTION
    WHEN undefined_function THEN
        -- If update_updated_at_column doesn't exist, we skip trigger for now
        -- This is a fallback to avoid migration failure
        NULL;
END $$;
