-- 1. DROP the permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.payments;

-- 2. Define a function or use user_metadata to check for admin/colaborador roles
-- For simplicity, we assume admins/collaborators are the ones who can manage these.

-- 3. Create refined policies for contracts
CREATE POLICY "Admins and Collaborators can insert contracts" 
ON public.contracts FOR INSERT TO authenticated 
WITH CHECK (
  auth.jwt() -> 'user_metadata' ->> 'role' IN ('admin', 'vendedor', 'colaborador')
);

CREATE POLICY "Admins and Collaborators can update contracts" 
ON public.contracts FOR UPDATE TO authenticated 
USING (
  auth.jwt() -> 'user_metadata' ->> 'role' IN ('admin', 'vendedor', 'colaborador')
);

-- 4. Create refined policies for payments
CREATE POLICY "Admins and Collaborators can insert payments" 
ON public.payments FOR INSERT TO authenticated 
WITH CHECK (
  auth.jwt() -> 'user_metadata' ->> 'role' IN ('admin', 'vendedor', 'colaborador')
);

CREATE POLICY "Admins and Collaborators can update payments" 
ON public.payments FOR UPDATE TO authenticated 
USING (
  auth.jwt() -> 'user_metadata' ->> 'role' IN ('admin', 'vendedor', 'colaborador')
);

-- Also add DELETE policies just in case
CREATE POLICY "Admins can delete contracts" 
ON public.contracts FOR DELETE TO authenticated 
USING (
  auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
);

CREATE POLICY "Admins can delete payments" 
ON public.payments FOR DELETE TO authenticated 
USING (
  auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
);
