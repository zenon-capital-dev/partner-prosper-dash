ALTER TABLE public.service_providers 
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS internal_rating NUMERIC CHECK (internal_rating >= 0 AND internal_rating <= 5);