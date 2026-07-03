
-- Allow partners to delete tasks they own/assigned
CREATE POLICY "Partners delete own tasks"
ON public.tasks
FOR DELETE
USING (
  has_role((SELECT auth.uid()), 'parceiro'::app_role)
  AND (created_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid()))
);

-- Partner profile: bank account type + one-time self edit lock
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS profile_locked_at timestamptz;
