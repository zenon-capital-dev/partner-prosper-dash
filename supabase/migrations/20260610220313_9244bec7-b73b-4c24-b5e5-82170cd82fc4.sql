DROP POLICY IF EXISTS "Authenticated users view active partner materials" ON public.partner_materials;
DROP POLICY IF EXISTS "Authenticated users read partner materials files" ON storage.objects;

CREATE POLICY "Partners view active partner materials"
ON public.partner_materials
FOR SELECT
TO authenticated
USING (
  active = true
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email')
  )
);

CREATE POLICY "Partners read partner material files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-materials'
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email')
  )
);

CREATE OR REPLACE FUNCTION public.protect_partner_contract_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role) THEN
    RETURN NEW;
  END IF;

  NEW.admin_notes := OLD.admin_notes;
  NEW.contract_signed_path := OLD.contract_signed_path;
  NEW.contract_uploaded_at := OLD.contract_uploaded_at;
  NEW.nda_signed_path := OLD.nda_signed_path;
  NEW.nda_uploaded_at := OLD.nda_uploaded_at;

  IF OLD.status = 'assinado' THEN
    RAISE EXCEPTION 'Contrato assinado não pode ser alterado pelo parceiro';
  END IF;

  IF NEW.status NOT IN ('rascunho', 'enviado') THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_partner_contract_admin_fields ON public.partner_contracts;
CREATE TRIGGER trg_protect_partner_contract_admin_fields
BEFORE UPDATE ON public.partner_contracts
FOR EACH ROW EXECUTE FUNCTION public.protect_partner_contract_admin_fields();

DROP POLICY IF EXISTS "Partners create own partner contracts" ON public.partner_contracts;
DROP POLICY IF EXISTS "Partners update own partner contract data" ON public.partner_contracts;

CREATE POLICY "Partners create own partner contracts"
ON public.partner_contracts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_contracts.partner_id
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  )
  AND status IN ('rascunho', 'enviado')
  AND admin_notes IS NULL
  AND contract_signed_path IS NULL
  AND contract_uploaded_at IS NULL
  AND nda_signed_path IS NULL
  AND nda_uploaded_at IS NULL
);

CREATE POLICY "Partners update own partner contract data"
ON public.partner_contracts
FOR UPDATE
TO authenticated
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
);