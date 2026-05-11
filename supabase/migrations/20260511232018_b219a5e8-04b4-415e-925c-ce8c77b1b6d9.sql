-- Remove remaining public document exposure
DROP POLICY IF EXISTS "Access documents through demands" ON public.documents;

-- Remove plaintext temporary password storage from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS temp_password;

-- Avoid broad realtime subscription exposure for private chat rows
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages;
  END IF;
END $$;

-- Make admin checks consistent for both admin roles
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role)
  )
$$;

-- Remove public execution from internal security-definer functions, then grant only the safe helpers/actions needed by app policies
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_delegated_provider(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_demand_activity(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_sla_due_date(timestamp with time zone, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO authenticated;