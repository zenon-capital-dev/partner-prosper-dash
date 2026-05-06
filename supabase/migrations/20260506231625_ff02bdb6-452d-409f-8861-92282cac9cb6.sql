-- 1. Create a security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(roles text[])
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'role') = ANY(roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. DROP the metadata-referencing policies
DROP POLICY IF EXISTS "Admins and Collaborators can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins and Collaborators can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins and Collaborators can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Admins and Collaborators can update payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;

-- 3. Re-create policies using the helper function
CREATE POLICY "Admins and Collaborators can insert contracts" 
ON public.contracts FOR INSERT TO authenticated 
WITH CHECK (public.has_role(ARRAY['admin', 'vendedor', 'colaborador']));

CREATE POLICY "Admins and Collaborators can update contracts" 
ON public.contracts FOR UPDATE TO authenticated 
USING (public.has_role(ARRAY['admin', 'vendedor', 'colaborador']));

CREATE POLICY "Admins and Collaborators can insert payments" 
ON public.payments FOR INSERT TO authenticated 
WITH CHECK (public.has_role(ARRAY['admin', 'vendedor', 'colaborador']));

CREATE POLICY "Admins and Collaborators can update payments" 
ON public.payments FOR UPDATE TO authenticated 
USING (public.has_role(ARRAY['admin', 'vendedor', 'colaborador']));

CREATE POLICY "Admins can delete contracts" 
ON public.contracts FOR DELETE TO authenticated 
USING (public.has_role(ARRAY['admin']));

CREATE POLICY "Admins can delete payments" 
ON public.payments FOR DELETE TO authenticated 
USING (public.has_role(ARRAY['admin']));
