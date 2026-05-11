
-- 1) Privilege escalation: restrictive policies on user_roles
DROP POLICY IF EXISTS "Only admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins delete roles" ON public.user_roles;

CREATE POLICY "Only admins insert roles"
ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins update roles"
ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins delete roles"
ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- 2) chat_messages: do not expose NULL-recipient messages to everyone
DROP POLICY IF EXISTS "Users see own chat" ON public.chat_messages;
CREATE POLICY "Users see own chat"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  sender_id = auth.uid()
  OR recipient_id = auth.uid()
  OR public.is_admin(auth.uid())
);
