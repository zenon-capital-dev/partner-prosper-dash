ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS admission_date date;