
-- 1) Partners: prevent self-elevation via trigger on UPDATE
CREATE OR REPLACE FUNCTION public.prevent_partner_self_privilege_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Admins bypass
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Block changes to privileged/admin-managed columns by the partner themselves
  IF NEW.commission_percent IS DISTINCT FROM OLD.commission_percent
     OR NEW.partner_category IS DISTINCT FROM OLD.partner_category
     OR NEW.is_full_carteira IS DISTINCT FROM OLD.is_full_carteira
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Não é permitido alterar campos administrativos do parceiro';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_partner_self_privilege_change ON public.partners;
CREATE TRIGGER trg_prevent_partner_self_privilege_change
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.prevent_partner_self_privilege_change();

-- 2) partner_contracts: prevent partners from updating admin-only fields
CREATE OR REPLACE FUNCTION public.prevent_partner_contract_admin_field_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.contract_signed_path IS DISTINCT FROM OLD.contract_signed_path
     OR NEW.contract_uploaded_at IS DISTINCT FROM OLD.contract_uploaded_at
     OR NEW.nda_signed_path IS DISTINCT FROM OLD.nda_signed_path
     OR NEW.nda_uploaded_at IS DISTINCT FROM OLD.nda_uploaded_at
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
    RAISE EXCEPTION 'Não é permitido alterar campos administrativos do contrato';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_partner_contract_admin_field_change ON public.partner_contracts;
CREATE TRIGGER trg_prevent_partner_contract_admin_field_change
  BEFORE UPDATE ON public.partner_contracts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_partner_contract_admin_field_change();

-- 3) collaborator_products: fix SELECT policy to resolve employee linkage correctly
DROP POLICY IF EXISTS "Collaborators view own product links" ON public.collaborator_products;
CREATE POLICY "Collaborators view own product links"
  ON public.collaborator_products FOR SELECT
  TO authenticated
  USING (
    collaborator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = collaborator_products.collaborator_id
        AND e.user_id = auth.uid()
    )
  );

-- 4) Revoke EXECUTE on SECURITY DEFINER functions from anon (only authenticated/service_role need them)
REVOKE EXECUTE ON FUNCTION public.apply_pool_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fill_demand_request_client() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_client_journey_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_client_closed_on_sale_finalized() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_demand_request() FROM anon;
REVOKE EXECUTE ON FUNCTION public.provider_has_demand_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sales_set_closed_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_involved_in_demand(uuid, uuid) FROM anon;
