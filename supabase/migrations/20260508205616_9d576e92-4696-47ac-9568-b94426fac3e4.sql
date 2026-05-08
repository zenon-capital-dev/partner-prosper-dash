-- Add service_provider_id to client_product_status_reports if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_product_status_reports' AND column_name = 'service_provider_id') THEN
        ALTER TABLE public.client_product_status_reports ADD COLUMN service_provider_id UUID REFERENCES public.service_providers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update RLS policies to use service_provider_id if available, otherwise reported_by
DROP POLICY IF EXISTS "Service providers can manage their own reports" ON public.client_product_status_reports;
CREATE POLICY "Service providers can manage their own reports"
ON public.client_product_status_reports
FOR ALL
USING (
    auth.uid() = reported_by OR 
    auth.uid() IN (SELECT user_id FROM public.service_providers WHERE id = service_provider_id)
);
