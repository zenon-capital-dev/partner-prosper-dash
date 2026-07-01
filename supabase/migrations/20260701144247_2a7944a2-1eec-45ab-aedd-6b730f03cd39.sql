-- Tighten demand request message policies so visibility follows the parent demand involvement rules.
DROP POLICY IF EXISTS "read messages when request visible" ON public.demand_request_messages;
DROP POLICY IF EXISTS "insert messages when request visible" ON public.demand_request_messages;
DROP POLICY IF EXISTS "author can update own message" ON public.demand_request_messages;
DROP POLICY IF EXISTS "author or admin can delete" ON public.demand_request_messages;

CREATE POLICY "Demand participants can read request messages"
ON public.demand_request_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.demand_requests dr
    WHERE dr.id = demand_request_messages.request_id
      AND (
        public.is_admin((SELECT auth.uid()))
        OR public.user_involved_in_demand((SELECT auth.uid()), dr.client_product_id)
      )
  )
);

CREATE POLICY "Demand participants can insert request messages"
ON public.demand_request_messages
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.demand_requests dr
    WHERE dr.id = demand_request_messages.request_id
      AND (
        public.is_admin((SELECT auth.uid()))
        OR public.user_involved_in_demand((SELECT auth.uid()), dr.client_product_id)
      )
  )
);

CREATE POLICY "Demand message authors can update own messages"
ON public.demand_request_messages
FOR UPDATE
TO authenticated
USING (
  author_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.demand_requests dr
    WHERE dr.id = demand_request_messages.request_id
      AND (
        public.is_admin((SELECT auth.uid()))
        OR public.user_involved_in_demand((SELECT auth.uid()), dr.client_product_id)
      )
  )
)
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.demand_requests dr
    WHERE dr.id = demand_request_messages.request_id
      AND (
        public.is_admin((SELECT auth.uid()))
        OR public.user_involved_in_demand((SELECT auth.uid()), dr.client_product_id)
      )
  )
);

CREATE POLICY "Demand message authors or admins can delete messages"
ON public.demand_request_messages
FOR DELETE
TO authenticated
USING (
  public.is_admin((SELECT auth.uid()))
  OR (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.demand_requests dr
      WHERE dr.id = demand_request_messages.request_id
        AND public.user_involved_in_demand((SELECT auth.uid()), dr.client_product_id)
    )
  )
);

-- Remove anonymous/public direct execution from internal SECURITY DEFINER trigger/helper functions.
REVOKE EXECUTE ON FUNCTION public.is_assigned_provider(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notification_enabled(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_client_stage_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_client_support_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_demand_comment_all() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_demand_request_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_demand_status_change() FROM PUBLIC, anon, authenticated;

-- Ensure authenticated users keep access to helper functions required by RLS policies.
GRANT EXECUTE ON FUNCTION public.is_assigned_provider(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_enabled(uuid, text) TO authenticated;