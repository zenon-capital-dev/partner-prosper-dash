
-- 1) Commissions: allow collaborators to see ONLY their own commission rows
CREATE POLICY "Collaborators view their own commissions"
ON public.commissions
FOR SELECT
TO authenticated
USING (collaborator_id = auth.uid());

-- 2) Employees: remove collaborator write escalation; keep SELECT for internal team
DROP POLICY IF EXISTS "Internal team manages employees" ON public.employees;

-- Admin / vendedor keep full management (admins also covered by "Admins total access")
CREATE POLICY "Admins and vendedor manage employees"
ON public.employees
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::app_role));

-- Collaborators get read-only visibility of the team
CREATE POLICY "Collaborators read employees"
ON public.employees
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'colaborador'::app_role));

-- 3) Storage: tighten partner-materials SELECT to only files referenced by an active partner_materials row
DROP POLICY IF EXISTS "Partners read partner material files" ON storage.objects;

CREATE POLICY "Partners read active partner material files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-materials'
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.user_id = auth.uid()
       OR lower(p.email) = lower((auth.jwt() ->> 'email'))
  )
  AND EXISTS (
    SELECT 1 FROM public.partner_materials pm
    WHERE pm.file_path = storage.objects.name
      AND pm.active = true
  )
);
