-- Add columns to profiles for manual access control
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS temp_password TEXT;

-- Add column to clients for service provider linkage
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS service_provider_id UUID REFERENCES public.service_providers(id);

-- Add manual financial columns to clients (or use the existing sales table if preferred, 
-- but the user asked to define these in the client context sometimes)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contract_value DECIMAL(12,2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS commission_value DECIMAL(12,2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS origin TEXT;

-- Update RLS for profiles to allow admins to manage all
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
