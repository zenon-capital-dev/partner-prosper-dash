ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS partner_commission_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS referrer_commission_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS collaborator_commission_percent numeric(5,2);