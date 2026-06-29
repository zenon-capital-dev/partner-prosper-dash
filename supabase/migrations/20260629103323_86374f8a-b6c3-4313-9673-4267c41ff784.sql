
-- 1) partner_contracts: restringir UPDATE de parceiros
DROP POLICY IF EXISTS "Partners update own partner contract data" ON public.partner_contracts;
CREATE POLICY "Partners update own partner contract data"
ON public.partner_contracts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_contracts.partner_id
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_contracts.partner_id
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  )
  AND status = ANY (ARRAY['rascunho'::text, 'enviado'::text])
  AND admin_notes IS NULL
  AND contract_signed_path IS NULL
  AND contract_uploaded_at IS NULL
  AND nda_signed_path IS NULL
  AND nda_uploaded_at IS NULL
);

-- 2) commissions: corrigir política do colaborador via employees.user_id
DROP POLICY IF EXISTS "Collaborators view their own commissions" ON public.commissions;
CREATE POLICY "Collaborators view their own commissions"
ON public.commissions
FOR SELECT
USING (
  collaborator_id IN (
    SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()
  )
);

-- 3) product_steps: leitura para autenticados (catálogo de etapas de produto)
CREATE POLICY "Authenticated users can read product steps"
ON public.product_steps
FOR SELECT
TO authenticated
USING (true);

-- 4) Revogar EXECUTE de anon/public em função SECURITY DEFINER exposta
REVOKE EXECUTE ON FUNCTION public.guard_partner_contracts_admin_fields() FROM PUBLIC, anon;
