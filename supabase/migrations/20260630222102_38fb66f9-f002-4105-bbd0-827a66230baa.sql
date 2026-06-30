-- Simplify storage RLS policies that were causing authenticated Storage calls to hang.
-- Keep the same business access, but remove duplicated/expensive policies and use indexed/path based checks.

-- Drop duplicated/heavy policies for the affected buckets.
DROP POLICY IF EXISTS "Admin/vendedor delete all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin/vendedor read all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin/vendedor update all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin/vendedor write all documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage all documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Client reads own folder" ON storage.objects;
DROP POLICY IF EXISTS "Client uploads to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Clients read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Clients upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Collaborators read assigned document files" ON storage.objects;
DROP POLICY IF EXISTS "Internal team uploads all documents" ON storage.objects;
DROP POLICY IF EXISTS "Partners read own document files" ON storage.objects;
DROP POLICY IF EXISTS "Partners read related document files" ON storage.objects;
DROP POLICY IF EXISTS "Partners upload own document files" ON storage.objects;
DROP POLICY IF EXISTS "Partners upload related demand files" ON storage.objects;
DROP POLICY IF EXISTS "Providers read delegated document files" ON storage.objects;
DROP POLICY IF EXISTS "Providers upload delegated demand files" ON storage.objects;
DROP POLICY IF EXISTS "Referrers read related document files" ON storage.objects;
DROP POLICY IF EXISTS "Internal team manages partner contract files" ON storage.objects;
DROP POLICY IF EXISTS "Partners read own partner contract files" ON storage.objects;
DROP POLICY IF EXISTS "Partners upload own signed contract files" ON storage.objects;
DROP POLICY IF EXISTS "Internal team manages partner materials files" ON storage.objects;
DROP POLICY IF EXISTS "Partners read active partner material files" ON storage.objects;
DROP POLICY IF EXISTS "Partners read partner materials files" ON storage.objects;

-- Ensure the policy lookups use indexes when they need to verify DB rows.
CREATE INDEX IF NOT EXISTS idx_partner_contracts_contract_template_path ON public.partner_contracts (contract_template_path) WHERE contract_template_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_contracts_nda_template_path ON public.partner_contracts (nda_template_path) WHERE nda_template_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_contracts_contract_signed_path ON public.partner_contracts (contract_signed_path) WHERE contract_signed_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_contracts_nda_signed_path ON public.partner_contracts (nda_signed_path) WHERE nda_signed_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_materials_file_path_active ON public.partner_materials (file_path) WHERE file_path IS NOT NULL AND active = true;
CREATE INDEX IF NOT EXISTS idx_clients_id_user_id ON public.clients (id, user_id);
CREATE INDEX IF NOT EXISTS idx_client_products_id_client_id ON public.client_products (id, client_id);
CREATE INDEX IF NOT EXISTS idx_client_partners_client_partner ON public.client_partners (client_id, partner_id);
CREATE INDEX IF NOT EXISTS idx_client_providers_client_provider ON public.client_providers (client_id, service_provider_id);
CREATE INDEX IF NOT EXISTS idx_client_referrers_client_referrer ON public.client_referrers (client_id, referrer_id);
CREATE INDEX IF NOT EXISTS idx_client_collaborators_client_collaborator ON public.client_collaborators (client_id, collaborator_id);
CREATE INDEX IF NOT EXISTS idx_documents_partner_file_path ON public.documents (partner_id, file_path) WHERE partner_id IS NOT NULL AND file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_document_requests_file_url_cp ON public.client_document_requests (file_url, client_product_id) WHERE file_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demand_deliveries_file_url_cp ON public.demand_deliveries (file_url, client_product_id) WHERE file_url IS NOT NULL;

-- Helper functions bypass public-table RLS and are intentionally narrow.
CREATE OR REPLACE FUNCTION private.storage_is_internal(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin'::public.app_role, 'admin_secondary'::public.app_role, 'vendedor'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION private.storage_partner_id_for_user(_user_id uuid, _email text)
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id
  FROM public.partners p
  WHERE p.user_id = _user_id
     OR lower(p.email) = lower(_email)
  ORDER BY CASE WHEN p.user_id = _user_id THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.storage_referrer_id_for_user(_user_id uuid, _email text)
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.id
  FROM public.referrers r
  WHERE r.user_id = _user_id
     OR lower(r.email) = lower(_email)
  ORDER BY CASE WHEN r.user_id = _user_id THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.storage_provider_id_for_user(_user_id uuid, _email text)
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sp.id
  FROM public.service_providers sp
  WHERE sp.user_id = _user_id
     OR lower(sp.email) = lower(_email)
  ORDER BY CASE WHEN sp.user_id = _user_id THEN 0 ELSE 1 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.storage_documents_can_read(_user_id uuid, _email text, _object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ctx AS (
    SELECT
      private.storage_partner_id_for_user(_user_id, _email) AS partner_id,
      private.storage_provider_id_for_user(_user_id, _email) AS provider_id,
      private.storage_referrer_id_for_user(_user_id, _email) AS referrer_id
  )
  SELECT
    private.storage_is_internal(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.user_id = _user_id
        AND split_part(_object_name, '/', 1) = c.id::text
    )
    OR EXISTS (
      SELECT 1
      FROM public.documents d, ctx
      WHERE d.file_path = _object_name
        AND (
          (d.partner_id IS NOT NULL AND d.partner_id = ctx.partner_id)
          OR (d.provider_id IS NOT NULL AND d.provider_id = ctx.provider_id)
          OR (d.collaborator_id IS NOT NULL AND d.collaborator_id = _user_id)
          OR (d.client_id IS NOT NULL AND (
            EXISTS (SELECT 1 FROM public.clients c WHERE c.id = d.client_id AND c.user_id = _user_id)
            OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = d.client_id AND c.partner_id = ctx.partner_id)
            OR EXISTS (SELECT 1 FROM public.client_partners cp WHERE cp.client_id = d.client_id AND cp.partner_id = ctx.partner_id)
            OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = d.client_id AND c.referrer_id = ctx.referrer_id)
            OR EXISTS (SELECT 1 FROM public.client_referrers cr WHERE cr.client_id = d.client_id AND cr.referrer_id = ctx.referrer_id)
            OR EXISTS (SELECT 1 FROM public.client_providers cpr WHERE cpr.client_id = d.client_id AND cpr.service_provider_id = ctx.provider_id)
            OR EXISTS (SELECT 1 FROM public.client_collaborators cc WHERE cc.client_id = d.client_id AND cc.collaborator_id = _user_id)
          ))
          OR (d.client_product_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM public.client_products cp
            WHERE cp.id = d.client_product_id
              AND (
                private.is_partner_for_client(_user_id, cp.client_id)
                OR private.is_referrer_for_client(_user_id, cp.client_id)
                OR private.is_delegated_provider(_user_id, cp.id)
                OR private.is_collaborator_for_client_product(_user_id, cp.id)
              )
          ))
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.client_document_requests cdr
      JOIN public.client_products cp ON cp.id = cdr.client_product_id
      WHERE cdr.file_url = _object_name
        AND (
          private.is_partner_for_client(_user_id, cp.client_id)
          OR private.is_delegated_provider(_user_id, cp.id)
          OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = cp.client_id AND c.user_id = _user_id)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.demand_deliveries dd
      JOIN public.client_products cp ON cp.id = dd.client_product_id
      WHERE dd.file_url = _object_name
        AND (
          private.is_partner_for_client(_user_id, cp.client_id)
          OR private.is_referrer_for_client(_user_id, cp.client_id)
          OR private.is_delegated_provider(_user_id, cp.id)
          OR private.is_collaborator_for_client_product(_user_id, cp.id)
          OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = cp.client_id AND c.user_id = _user_id)
        )
    );
$$;

CREATE OR REPLACE FUNCTION private.storage_documents_can_insert(_user_id uuid, _email text, _object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ctx AS (
    SELECT
      split_part(_object_name, '/', 1) AS first_part,
      split_part(_object_name, '/', 2) AS second_part,
      private.storage_partner_id_for_user(_user_id, _email) AS partner_id,
      private.storage_provider_id_for_user(_user_id, _email) AS provider_id
  )
  SELECT
    private.storage_is_internal(_user_id)
    OR EXISTS (
      SELECT 1 FROM ctx
      WHERE first_part = 'partners'
        AND second_part = partner_id::text
    )
    OR EXISTS (
      SELECT 1
      FROM ctx
      JOIN public.clients c ON c.id::text = ctx.first_part
      WHERE c.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM ctx
      JOIN public.client_products cp ON cp.id::text = ctx.first_part
      WHERE private.is_partner_for_client(_user_id, cp.client_id)
         OR private.is_delegated_provider(_user_id, cp.id)
         OR provider_has_demand_access(_user_id, cp.id)
    );
$$;

CREATE OR REPLACE FUNCTION private.storage_partner_contracts_can_read(_user_id uuid, _email text, _object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    private.storage_is_internal(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.partner_contracts pc
      JOIN public.partners p ON p.id = pc.partner_id
      WHERE (pc.contract_template_path = _object_name
             OR pc.nda_template_path = _object_name
             OR pc.contract_signed_path = _object_name
             OR pc.nda_signed_path = _object_name)
        AND (p.user_id = _user_id OR lower(p.email) = lower(_email))
    )
    OR split_part(_object_name, '/', 1) = private.storage_partner_id_for_user(_user_id, _email)::text;
$$;

CREATE OR REPLACE FUNCTION private.storage_partner_contracts_can_insert(_user_id uuid, _email text, _object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    private.storage_is_internal(_user_id)
    OR split_part(_object_name, '/', 1) = private.storage_partner_id_for_user(_user_id, _email)::text;
$$;

CREATE OR REPLACE FUNCTION private.storage_partner_materials_can_read(_user_id uuid, _email text, _object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    private.storage_is_internal(_user_id)
    OR (
      private.storage_partner_id_for_user(_user_id, _email) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.partner_materials pm
        WHERE pm.file_path = _object_name
          AND pm.active = true
      )
    );
$$;

-- Compact policies for documents bucket.
CREATE POLICY "documents storage read fast" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND private.storage_documents_can_read((SELECT auth.uid()), (SELECT auth.jwt() ->> 'email'), name)
);

CREATE POLICY "documents storage insert fast" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND private.storage_documents_can_insert((SELECT auth.uid()), (SELECT auth.jwt() ->> 'email'), name)
);

CREATE POLICY "documents storage update fast" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND private.storage_documents_can_read((SELECT auth.uid()), (SELECT auth.jwt() ->> 'email'), name)
)
WITH CHECK (
  bucket_id = 'documents'
  AND private.storage_documents_can_insert((SELECT auth.uid()), (SELECT auth.jwt() ->> 'email'), name)
);

CREATE POLICY "documents storage delete internal fast" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND private.storage_is_internal((SELECT auth.uid()))
);

-- Compact policies for partner-contracts bucket.
CREATE POLICY "partner contracts storage read fast" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'partner-contracts'
  AND private.storage_partner_contracts_can_read((SELECT auth.uid()), (SELECT auth.jwt() ->> 'email'), name)
);

CREATE POLICY "partner contracts storage insert fast" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'partner-contracts'
  AND private.storage_partner_contracts_can_insert((SELECT auth.uid()), (SELECT auth.jwt() ->> 'email'), name)
);

CREATE POLICY "partner contracts storage update fast" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'partner-contracts'
  AND private.storage_partner_contracts_can_insert((SELECT auth.uid()), (SELECT auth.jwt() ->> 'email'), name)
)
WITH CHECK (
  bucket_id = 'partner-contracts'
  AND private.storage_partner_contracts_can_insert((SELECT auth.uid()), (SELECT auth.jwt() ->> 'email'), name)
);

CREATE POLICY "partner contracts storage delete internal fast" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'partner-contracts'
  AND private.storage_is_internal((SELECT auth.uid()))
);

-- Compact policies for partner-materials bucket.
CREATE POLICY "partner materials storage read fast" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'partner-materials'
  AND private.storage_partner_materials_can_read((SELECT auth.uid()), (SELECT auth.jwt() ->> 'email'), name)
);

CREATE POLICY "partner materials storage write internal fast" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'partner-materials'
  AND private.storage_is_internal((SELECT auth.uid()))
);

CREATE POLICY "partner materials storage update internal fast" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'partner-materials'
  AND private.storage_is_internal((SELECT auth.uid()))
)
WITH CHECK (
  bucket_id = 'partner-materials'
  AND private.storage_is_internal((SELECT auth.uid()))
);

CREATE POLICY "partner materials storage delete internal fast" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'partner-materials'
  AND private.storage_is_internal((SELECT auth.uid()))
);

GRANT EXECUTE ON FUNCTION private.storage_is_internal(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.storage_partner_id_for_user(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.storage_referrer_id_for_user(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.storage_provider_id_for_user(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.storage_documents_can_read(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.storage_documents_can_insert(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.storage_partner_contracts_can_read(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.storage_partner_contracts_can_insert(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.storage_partner_materials_can_read(uuid, text, text) TO authenticated, service_role;