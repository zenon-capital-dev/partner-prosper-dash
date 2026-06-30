ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_zip_code TEXT;

CREATE POLICY "Partners create own tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  has_role((SELECT auth.uid()), 'parceiro'::public.app_role)
  AND (created_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid()))
);

CREATE POLICY "Partners view own tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  has_role((SELECT auth.uid()), 'parceiro'::public.app_role)
  AND (created_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid()))
);

CREATE POLICY "Partners update own tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  has_role((SELECT auth.uid()), 'parceiro'::public.app_role)
  AND (created_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid()))
)
WITH CHECK (
  has_role((SELECT auth.uid()), 'parceiro'::public.app_role)
  AND (created_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid()))
);