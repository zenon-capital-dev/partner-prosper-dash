
ALTER TABLE public.commissions ALTER COLUMN sale_id DROP NOT NULL;
ALTER TABLE public.commissions ALTER COLUMN percent DROP NOT NULL;
ALTER TABLE public.commissions ALTER COLUMN percent SET DEFAULT 0;
