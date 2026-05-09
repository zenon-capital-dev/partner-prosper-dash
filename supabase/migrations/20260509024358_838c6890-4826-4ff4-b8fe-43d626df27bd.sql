
ALTER TABLE public.client_product_status_reports
  ADD COLUMN IF NOT EXISTS pending TEXT,
  ADD COLUMN IF NOT EXISTS next_steps TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
