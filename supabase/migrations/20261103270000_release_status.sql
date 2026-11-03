-- Commit this migration before applying financial_rules.
ALTER TYPE public.split_status ADD VALUE IF NOT EXISTS 'liberada';
