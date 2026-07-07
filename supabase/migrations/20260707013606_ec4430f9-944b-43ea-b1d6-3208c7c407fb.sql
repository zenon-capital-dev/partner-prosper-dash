
-- ============================================================
-- 1) DOCUMENTS: consolidar políticas UPDATE de cliente
-- ============================================================
DROP POLICY IF EXISTS "Client uploads own documents" ON public.documents;
DROP POLICY IF EXISTS "Clientes atualizam envio de seus docs" ON public.documents;
DROP POLICY IF EXISTS "Clients can update their own documents" ON public.documents;
-- Sobra apenas "Clients can update rejected documents", que restringe status permitidos e força novo status='enviado'.

-- ============================================================
-- 2) CONTRACTS: remover UPDATE amplo para cliente
-- ============================================================
DROP POLICY IF EXISTS "Clients can upload signed contract" ON public.contracts;
-- Sobra "Clients can sign own contracts" (obriga status='assinado' no WITH CHECK).

-- ============================================================
-- 3) PARTNER_CONTRACTS: consolidar em um único trigger cobrindo TODOS os campos admin-only
-- ============================================================
DROP TRIGGER IF EXISTS trg_prevent_partner_contract_admin_field_change ON public.partner_contracts;
DROP TRIGGER IF EXISTS trg_guard_partner_contracts_admin_fields ON public.partner_contracts;
DROP TRIGGER IF EXISTS trg_protect_partner_contract_admin_fields ON public.partner_contracts;

DROP FUNCTION IF EXISTS public.prevent_partner_contract_admin_field_change() CASCADE;
DROP FUNCTION IF EXISTS public.guard_partner_contracts_admin_fields() CASCADE;
DROP FUNCTION IF EXISTS public.protect_partner_contract_admin_fields() CASCADE;

CREATE OR REPLACE FUNCTION public.enforce_partner_contract_field_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins e vendedores podem tudo
  IF private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Contrato já assinado não pode ser alterado pelo parceiro
  IF OLD.status = 'assinado' THEN
    RAISE EXCEPTION 'Contrato assinado não pode ser alterado pelo parceiro';
  END IF;

  -- Campos exclusivos do admin: bloquear qualquer alteração
  IF NEW.admin_notes           IS DISTINCT FROM OLD.admin_notes
     OR NEW.contract_template_path         IS DISTINCT FROM OLD.contract_template_path
     OR NEW.contract_template_uploaded_at  IS DISTINCT FROM OLD.contract_template_uploaded_at
     OR NEW.nda_template_path              IS DISTINCT FROM OLD.nda_template_path
     OR NEW.nda_template_uploaded_at       IS DISTINCT FROM OLD.nda_template_uploaded_at
     OR NEW.partner_id                     IS DISTINCT FROM OLD.partner_id
     OR NEW.user_id                        IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Não é permitido alterar campos administrativos do contrato';
  END IF;

  -- Status só pode transitar entre rascunho/enviado pelo parceiro
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('rascunho', 'enviado') THEN
    RAISE EXCEPTION 'Parceiro não pode definir esse status do contrato';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_partner_contract_field_scope
BEFORE UPDATE ON public.partner_contracts
FOR EACH ROW EXECUTE FUNCTION public.enforce_partner_contract_field_scope();

-- ============================================================
-- 4) POLÍTICAS ADMIN REDUNDANTES: consolidar para usar apenas helpers private.*
-- ============================================================

-- leads: manter apenas "Admins total access" (helper-based)
DROP POLICY IF EXISTS "Admins can do everything on leads" ON public.leads;
DROP POLICY IF EXISTS "Admins manage leads" ON public.leads;

-- service_providers: remover a política ALL baseada em subquery direta em user_roles
DROP POLICY IF EXISTS "Admins manage service providers" ON public.service_providers;

-- tasks: substituir subquery direta em user_roles por helper
DROP POLICY IF EXISTS "Admins can do everything on tasks" ON public.tasks;
CREATE POLICY "Admins manage all tasks"
ON public.tasks
FOR ALL
TO authenticated
USING (private.is_admin((select auth.uid())))
WITH CHECK (private.is_admin((select auth.uid())));

-- documents: remover cláusula OR user_roles redundante da SELECT de cliente
DROP POLICY IF EXISTS "Clients view own documents" ON public.documents;
CREATE POLICY "Clients view own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.user_id = (select auth.uid()))
);
-- Admins/vendedores continuam com acesso via "Admins/vendedores view all documents".

-- ============================================================
-- 5) SECURITY DEFINER acessível por anon: revogar EXECUTE
--    (função de trigger — não deve ser chamada pelo Data API)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.set_sale_stage_snapshot() FROM PUBLIC, anon, authenticated;
