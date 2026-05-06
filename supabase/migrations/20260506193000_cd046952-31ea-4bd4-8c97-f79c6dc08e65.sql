-- Add address components and referral to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_zip_code TEXT;

-- If referral_id was not on clients but was intended for tracking:
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES public.profiles(id);
