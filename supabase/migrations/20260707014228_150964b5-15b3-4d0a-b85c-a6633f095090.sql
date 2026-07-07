
-- ============================================================
-- 1) activity_logs: reforçar WITH CHECK do INSERT
-- ============================================================
DROP POLICY IF EXISTS "Authorized users insert demand activity logs" ON public.activity_logs;

CREATE POLICY "Authorized users insert demand activity logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  AND entity_type IS NOT NULL
  AND (
    -- Admins podem registrar log para qualquer entidade
    private.is_admin((select auth.uid()))
    OR (
      -- Demais usuários: apenas para client_product em que estão envolvidos e sem forjar ip_address
      entity_type = 'client_product'
      AND entity_id IS NOT NULL
      AND ip_address IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.client_products cp
        JOIN public.clients c ON c.id = cp.client_id
        LEFT JOIN public.partners p ON p.id = c.partner_id
        WHERE cp.id = activity_logs.entity_id
          AND (
            private.has_role((select auth.uid()), 'vendedor'::app_role)
            OR private.has_role((select auth.uid()), 'colaborador'::app_role)
            OR c.user_id = (select auth.uid())
            OR p.user_id = (select auth.uid())
            OR private.is_delegated_provider((select auth.uid()), cp.id)
          )
      )
    )
  )
);

-- ============================================================
-- 2) product_document_folders / files: forçar ownership dos campos created_by / uploaded_by
-- ============================================================
CREATE OR REPLACE FUNCTION public.force_owner_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.force_owner_uploaded_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.uploaded_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_owner_created_by_folders ON public.product_document_folders;
CREATE TRIGGER trg_force_owner_created_by_folders
BEFORE INSERT ON public.product_document_folders
FOR EACH ROW EXECUTE FUNCTION public.force_owner_created_by();

DROP TRIGGER IF EXISTS trg_force_owner_uploaded_by_files ON public.product_document_files;
CREATE TRIGGER trg_force_owner_uploaded_by_files
BEFORE INSERT ON public.product_document_files
FOR EACH ROW EXECUTE FUNCTION public.force_owner_uploaded_by();

-- Bloquear alteração desses campos após criação
CREATE OR REPLACE FUNCTION public.lock_created_by_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_uploaded_by_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
    NEW.uploaded_by := OLD.uploaded_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_created_by_folders ON public.product_document_folders;
CREATE TRIGGER trg_lock_created_by_folders
BEFORE UPDATE ON public.product_document_folders
FOR EACH ROW EXECUTE FUNCTION public.lock_created_by_column();

DROP TRIGGER IF EXISTS trg_lock_uploaded_by_files ON public.product_document_files;
CREATE TRIGGER trg_lock_uploaded_by_files
BEFORE UPDATE ON public.product_document_files
FOR EACH ROW EXECUTE FUNCTION public.lock_uploaded_by_column();

-- ============================================================
-- 3) commissions: política RESTRICTIVE explícita — só admins/service_role escrevem
-- ============================================================
DROP POLICY IF EXISTS "Only admins may write commissions" ON public.commissions;
CREATE POLICY "Only admins may write commissions"
ON public.commissions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (private.check_is_admin((select auth.uid())))
WITH CHECK (private.check_is_admin((select auth.uid())));
