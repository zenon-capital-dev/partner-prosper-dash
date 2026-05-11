-- Harden policy role scopes and close remaining RLS gaps

-- 1) Critical finding: authenticated users could insert activity logs for any client_product.
DROP POLICY IF EXISTS "Authorized users insert demand activity logs" ON public.activity_logs;
CREATE POLICY "Authorized users insert demand activity logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND entity_type = 'client_product'
  AND entity_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.clients c ON c.id = cp.client_id
    LEFT JOIN public.partners p ON p.id = c.partner_id
    WHERE cp.id = activity_logs.entity_id
      AND (
        private.is_admin(auth.uid())
        OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
        OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
        OR c.user_id = auth.uid()
        OR p.user_id = auth.uid()
        OR private.is_delegated_provider(auth.uid(), cp.id)
      )
  )
);

-- 2) Finding: user_roles own-role read policy must not apply to PUBLIC/anon.
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3) Finding: colaboradores manage related operational data but could not read timeline.
DROP POLICY IF EXISTS "Admin/Vendedor read timeline" ON public.client_timeline;
CREATE POLICY "Internal team read timeline"
ON public.client_timeline
FOR SELECT
TO authenticated
USING (
  private.is_admin(auth.uid())
  OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
  OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
);

-- 4) Keep timeline writes explicit to authenticated internal roles only.
DROP POLICY IF EXISTS "Admin/Vendedor write timeline" ON public.client_timeline;
CREATE POLICY "Internal team write timeline"
ON public.client_timeline
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_admin(auth.uid())
  OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
  OR private.has_role(auth.uid(), 'colaborador'::public.app_role)
);

-- 5) Restrict storage policies that were accidentally scoped to PUBLIC.
DROP POLICY IF EXISTS "Admin/vendedor read all documents" ON storage.objects;
CREATE POLICY "Admin/vendedor read all documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admin/vendedor write all documents" ON storage.objects;
CREATE POLICY "Admin/vendedor write all documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admin/vendedor update all documents" ON storage.objects;
CREATE POLICY "Admin/vendedor update all documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admin/vendedor delete all documents" ON storage.objects;
CREATE POLICY "Admin/vendedor delete all documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'vendedor'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Client reads own folder" ON storage.objects;
CREATE POLICY "Client reads own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.clients c
    WHERE c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Client uploads to own folder" ON storage.objects;
CREATE POLICY "Client uploads to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.clients c
    WHERE c.user_id = auth.uid()
  )
);

-- 6) Remove direct API execution from internal permission helpers.
-- RLS can still use these functions; clients should read user_roles through RLS instead.
REVOKE EXECUTE ON FUNCTION private.check_is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.check_user_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.is_delegated_provider(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 7) Prevent future public grants by default for new public/private functions.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 8) Re-assert financial/report views as invoker views so base-table RLS applies.
ALTER VIEW public.view_client_financial_summary SET (security_invoker = true);
ALTER VIEW public.view_performance_by_product SET (security_invoker = true);
ALTER VIEW public.view_performance_by_source SET (security_invoker = true);