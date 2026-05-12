-- Clean up duplicated/conflicting policies on user_roles
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins total access" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Block non-admin role inserts" ON public.user_roles;
DROP POLICY IF EXISTS "Block non-admin role updates" ON public.user_roles;
DROP POLICY IF EXISTS "Block non-admin role deletes" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Recreate explicit, role-scoped policies (authenticated only)
CREATE POLICY "user_roles select own"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

CREATE POLICY "user_roles admin insert"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "user_roles admin update"
ON public.user_roles FOR UPDATE TO authenticated
USING (private.is_admin(auth.uid()))
WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "user_roles admin delete"
ON public.user_roles FOR DELETE TO authenticated
USING (private.is_admin(auth.uid()));

-- Client can read own timeline
DROP POLICY IF EXISTS "Clients view own timeline" ON public.client_timeline;
CREATE POLICY "Clients view own timeline"
ON public.client_timeline FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_timeline.client_id
      AND c.user_id = auth.uid()
  )
);