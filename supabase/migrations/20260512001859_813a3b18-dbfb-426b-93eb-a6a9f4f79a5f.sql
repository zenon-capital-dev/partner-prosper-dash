-- Notifications: lock INSERT to admins/internal team (triggers run as SECURITY DEFINER so they bypass RLS)
DROP POLICY IF EXISTS "Users can insert their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;

CREATE POLICY "notifications admin insert"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  private.is_admin(auth.uid())
  OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
);

-- Ensure user can delete own notifications
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

-- Fix clients self-view
DROP POLICY IF EXISTS "Clients view own data" ON public.clients;