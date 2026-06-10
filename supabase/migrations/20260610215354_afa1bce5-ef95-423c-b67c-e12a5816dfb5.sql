-- Tables expected by partner materials/contracts screens
CREATE TABLE IF NOT EXISTS public.partner_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'institucional',
  file_path text,
  external_url text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_materials TO authenticated;
GRANT ALL ON public.partner_materials TO service_role;

ALTER TABLE public.partner_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal team manages partner materials" ON public.partner_materials;
DROP POLICY IF EXISTS "Authenticated users view active partner materials" ON public.partner_materials;

CREATE POLICY "Internal team manages partner materials"
ON public.partner_materials
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role));

CREATE POLICY "Authenticated users view active partner materials"
ON public.partner_materials
FOR SELECT
TO authenticated
USING (active = true);

CREATE TABLE IF NOT EXISTS public.partner_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id uuid,
  status text NOT NULL DEFAULT 'rascunho',
  person_type text NOT NULL DEFAULT 'pf',
  full_name text,
  cpf text,
  rg text,
  rg_issuer text,
  birth_date date,
  marital_status text,
  nationality text,
  profession text,
  company_name text,
  company_cnpj text,
  legal_representative_name text,
  legal_representative_cpf text,
  legal_representative_role text,
  email text,
  phone text,
  whatsapp text,
  address_zip text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text,
  pix_key text,
  notes text,
  admin_notes text,
  form_submitted_at timestamptz,
  contract_signed_path text,
  contract_uploaded_at timestamptz,
  nda_signed_path text,
  nda_uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_contracts_partner_unique UNIQUE (partner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_contracts TO authenticated;
GRANT ALL ON public.partner_contracts TO service_role;

ALTER TABLE public.partner_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal team manages partner contracts" ON public.partner_contracts;
DROP POLICY IF EXISTS "Partners manage own partner contracts" ON public.partner_contracts;

CREATE POLICY "Internal team manages partner contracts"
ON public.partner_contracts
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role));

CREATE POLICY "Partners manage own partner contracts"
ON public.partner_contracts
FOR ALL
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

DROP TRIGGER IF EXISTS update_partner_materials_updated_at ON public.partner_materials;
CREATE TRIGGER update_partner_materials_updated_at
BEFORE UPDATE ON public.partner_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_contracts_updated_at ON public.partner_contracts;
CREATE TRIGGER update_partner_contracts_updated_at
BEFORE UPDATE ON public.partner_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies: partner materials
DROP POLICY IF EXISTS "Admins manage all partner-materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read partner-materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read partner-materials" ON storage.objects;
DROP POLICY IF EXISTS "Internal team manages partner materials files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users read partner materials files" ON storage.objects;

CREATE POLICY "Internal team manages partner materials files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'partner-materials'
  AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
)
WITH CHECK (
  bucket_id = 'partner-materials'
  AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
);

CREATE POLICY "Authenticated users read partner materials files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'partner-materials');

-- Storage policies: partner contracts
DROP POLICY IF EXISTS "Internal team manages partner contract files" ON storage.objects;
DROP POLICY IF EXISTS "Partners read own partner contract files" ON storage.objects;

CREATE POLICY "Internal team manages partner contract files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'partner-contracts'
  AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
)
WITH CHECK (
  bucket_id = 'partner-contracts'
  AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
);

CREATE POLICY "Partners read own partner contract files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-contracts'
  AND EXISTS (
    SELECT 1
    FROM public.partner_contracts pc
    JOIN public.partners p ON p.id = pc.partner_id
    WHERE (pc.contract_signed_path = storage.objects.name OR pc.nda_signed_path = storage.objects.name)
      AND (p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  )
);

-- Storage policies: shared documents/deliverables
DROP POLICY IF EXISTS "Partners read related document files" ON storage.objects;
DROP POLICY IF EXISTS "Referrers read related document files" ON storage.objects;
DROP POLICY IF EXISTS "Providers read delegated document files" ON storage.objects;
DROP POLICY IF EXISTS "Collaborators read assigned document files" ON storage.objects;
DROP POLICY IF EXISTS "Providers upload delegated demand files" ON storage.objects;

CREATE POLICY "Partners read related document files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
        AND (
          (d.client_id IS NOT NULL AND private.is_partner_for_client(auth.uid(), d.client_id))
          OR (d.client_product_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.client_products cp
            WHERE cp.id = d.client_product_id AND private.is_partner_for_client(auth.uid(), cp.client_id)
          ))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.client_document_requests cdr
      JOIN public.client_products cp ON cp.id = cdr.client_product_id
      WHERE cdr.file_url = storage.objects.name AND private.is_partner_for_client(auth.uid(), cp.client_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.demand_deliveries dd
      JOIN public.client_products cp ON cp.id = dd.client_product_id
      WHERE dd.file_url = storage.objects.name AND private.is_partner_for_client(auth.uid(), cp.client_id)
    )
  )
);

CREATE POLICY "Referrers read related document files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
        AND (
          (d.client_id IS NOT NULL AND private.is_referrer_for_client(auth.uid(), d.client_id))
          OR (d.client_product_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.client_products cp
            WHERE cp.id = d.client_product_id AND private.is_referrer_for_client(auth.uid(), cp.client_id)
          ))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.demand_deliveries dd
      JOIN public.client_products cp ON cp.id = dd.client_product_id
      WHERE dd.file_url = storage.objects.name AND private.is_referrer_for_client(auth.uid(), cp.client_id)
    )
  )
);

CREATE POLICY "Providers read delegated document files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
        AND (
          (d.provider_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.service_providers sp
            WHERE sp.id = d.provider_id AND (sp.user_id = auth.uid() OR lower(sp.email) = lower(auth.jwt() ->> 'email'))
          ))
          OR (d.client_product_id IS NOT NULL AND private.is_delegated_provider(auth.uid(), d.client_product_id))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.client_document_requests cdr
      WHERE cdr.file_url = storage.objects.name AND private.is_delegated_provider(auth.uid(), cdr.client_product_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.demand_deliveries dd
      WHERE dd.file_url = storage.objects.name AND private.is_delegated_provider(auth.uid(), dd.client_product_id)
    )
  )
);

CREATE POLICY "Collaborators read assigned document files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
        AND (
          d.collaborator_id = auth.uid()
          OR (d.client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), d.client_id))
          OR (d.client_product_id IS NOT NULL AND private.is_collaborator_for_client_product(auth.uid(), d.client_product_id))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.demand_deliveries dd
      WHERE dd.file_url = storage.objects.name AND private.is_collaborator_for_client_product(auth.uid(), dd.client_product_id)
    )
  )
);

CREATE POLICY "Providers upload delegated demand files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND private.is_delegated_provider(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Performance indexes for heavy tabs and shared files
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_due ON public.tasks(assigned_to, due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tasks_client_product_id ON public.tasks(client_product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON public.sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_partner_date ON public.sales(partner_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_client_date ON public.sales(client_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_commission_splits_sale_id ON public.commission_splits(sale_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_beneficiary ON public.commission_splits(beneficiary_type, beneficiary_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_client_due ON public.payments(client_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_file_path ON public.documents(file_path) WHERE file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_document_requests_file_url ON public.client_document_requests(file_url) WHERE file_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demand_deliveries_file_url ON public.demand_deliveries(file_url) WHERE file_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_materials_active_created ON public.partner_materials(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_contracts_partner_id ON public.partner_contracts(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_contracts_files ON public.partner_contracts(contract_signed_path, nda_signed_path);
CREATE INDEX IF NOT EXISTS idx_clients_partner_created ON public.clients(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_status_created ON public.clients(status, created_at DESC);