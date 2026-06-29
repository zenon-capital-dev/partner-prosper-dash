
-- 1) Employees: drop overly-broad collaborator SELECT
DROP POLICY IF EXISTS "Collaborators read employees" ON public.employees;

-- 2) Activity logs: allow users to read their own logs, and harden INSERT
CREATE POLICY "Users read own activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authorized users insert demand activity logs" ON public.activity_logs;
CREATE POLICY "Authorized users insert demand activity logs"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND entity_type = 'client_product'
    AND entity_id IS NOT NULL
    AND (ip_address IS NULL OR private.is_admin(auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM client_products cp
      JOIN clients c ON c.id = cp.client_id
      LEFT JOIN partners p ON p.id = c.partner_id
      WHERE cp.id = activity_logs.entity_id
        AND (
          private.is_admin(auth.uid())
          OR private.has_role(auth.uid(), 'vendedor'::app_role)
          OR private.has_role(auth.uid(), 'colaborador'::app_role)
          OR c.user_id = auth.uid()
          OR p.user_id = auth.uid()
          OR private.is_delegated_provider(auth.uid(), cp.id)
        )
    )
  );

-- 3) Partner contracts: trigger to block partners from modifying admin-only fields
CREATE OR REPLACE FUNCTION public.guard_partner_contracts_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.contract_signed_path IS DISTINCT FROM OLD.contract_signed_path
     OR NEW.nda_signed_path IS DISTINCT FROM OLD.nda_signed_path
     OR NEW.contract_uploaded_at IS DISTINCT FROM OLD.contract_uploaded_at
     OR NEW.nda_uploaded_at IS DISTINCT FROM OLD.nda_uploaded_at
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Partners cannot modify admin-controlled fields on partner_contracts';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_partner_contracts_admin_fields ON public.partner_contracts;
CREATE TRIGGER trg_guard_partner_contracts_admin_fields
  BEFORE UPDATE ON public.partner_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_partner_contracts_admin_fields();
