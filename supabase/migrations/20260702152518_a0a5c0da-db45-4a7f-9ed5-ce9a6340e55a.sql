ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS competence_month date;

-- Backfill: use due_date (fallback paid_at) truncated to first day of month
UPDATE public.payments
SET competence_month = date_trunc('month', COALESCE(due_date, paid_at::date, created_at::date))::date
WHERE competence_month IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_competence_month ON public.payments(competence_month);