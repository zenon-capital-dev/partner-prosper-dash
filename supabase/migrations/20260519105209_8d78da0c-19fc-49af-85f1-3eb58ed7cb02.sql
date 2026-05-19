-- Funções auxiliares seguras para relacionamento entre papéis e registros
CREATE OR REPLACE FUNCTION private.is_partner_for_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.partners p ON p.id = c.partner_id
    WHERE c.id = _client_id
      AND (p.user_id = _user_id OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  );
$$;

CREATE OR REPLACE FUNCTION private.is_referrer_for_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.referrers r ON r.id = c.referrer_id
    WHERE c.id = _client_id
      AND (r.user_id = _user_id OR lower(r.email) = lower(auth.jwt() ->> 'email'))
  );
$$;

CREATE OR REPLACE FUNCTION private.is_collaborator_for_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = _client_id
      AND c.collaborator_id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.client_products cp
    WHERE cp.client_id = _client_id
      AND cp.responsible_employee_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_delegated_provider(_user_id uuid, _client_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_products cp
    JOIN public.service_providers sp
      ON sp.id = cp.service_provider_id OR sp.id = cp.responsible_provider_id
    WHERE cp.id = _client_product_id
      AND (sp.user_id = _user_id OR lower(sp.email) = lower(auth.jwt() ->> 'email'))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_delegated_provider(_user_id uuid, _client_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT private.is_delegated_provider(_user_id, _client_product_id);
$$;

-- Parceiro: fallback por e-mail e leitura de clientes/demandas relacionados
DROP POLICY IF EXISTS "Partner views referred clients" ON public.clients;
DROP POLICY IF EXISTS "Partners view their clients" ON public.clients;
CREATE POLICY "Partners view their clients"
ON public.clients
FOR SELECT
TO authenticated
USING (private.is_partner_for_client(auth.uid(), id) OR private.is_admin());

DROP POLICY IF EXISTS "Partners access their referred client products" ON public.client_products;
CREATE POLICY "Partners access their referred client products"
ON public.client_products
FOR SELECT
TO authenticated
USING (private.is_partner_for_client(auth.uid(), client_id));

-- Indicador: leitura de demandas dos clientes indicados
DROP POLICY IF EXISTS "Referrers view referred client products" ON public.client_products;
CREATE POLICY "Referrers view referred client products"
ON public.client_products
FOR SELECT
TO authenticated
USING (private.is_referrer_for_client(auth.uid(), client_id));

-- Prestador: leitura/edição por prestador principal ou responsável técnico
DROP POLICY IF EXISTS "Provider views delegated products" ON public.client_products;
CREATE POLICY "Provider views delegated products"
ON public.client_products
FOR SELECT
TO authenticated
USING (private.is_delegated_provider(auth.uid(), id));

DROP POLICY IF EXISTS "Provider updates delegated products" ON public.client_products;
CREATE POLICY "Provider updates delegated products"
ON public.client_products
FOR UPDATE
TO authenticated
USING (private.is_delegated_provider(auth.uid(), id))
WITH CHECK (private.is_delegated_provider(auth.uid(), id));

-- Documentos: leitura por papel vinculado ao cliente ou demanda
DROP POLICY IF EXISTS "Partners view related documents" ON public.documents;
CREATE POLICY "Partners view related documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  (client_id IS NOT NULL AND private.is_partner_for_client(auth.uid(), client_id))
  OR (client_product_id IS NOT NULL AND client_product_id IN (
    SELECT cp.id FROM public.client_products cp WHERE private.is_partner_for_client(auth.uid(), cp.client_id)
  ))
);

DROP POLICY IF EXISTS "Referrers view related documents" ON public.documents;
CREATE POLICY "Referrers view related documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  (client_id IS NOT NULL AND private.is_referrer_for_client(auth.uid(), client_id))
  OR (client_product_id IS NOT NULL AND client_product_id IN (
    SELECT cp.id FROM public.client_products cp WHERE private.is_referrer_for_client(auth.uid(), cp.client_id)
  ))
);

DROP POLICY IF EXISTS "Provider views delegated documents" ON public.documents;
CREATE POLICY "Provider views delegated documents"
ON public.documents
FOR SELECT
TO authenticated
USING ((client_product_id IS NOT NULL) AND private.is_delegated_provider(auth.uid(), client_product_id));

-- Contratos: leitura quando ligados diretamente ao papel, ao cliente ou à demanda
DROP POLICY IF EXISTS "Partners can view their own contracts" ON public.contracts;
CREATE POLICY "Partners can view their own contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  (partner_id IN (SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email')))
  OR (client_id IS NOT NULL AND private.is_partner_for_client(auth.uid(), client_id))
  OR (client_product_id IS NOT NULL AND client_product_id IN (
    SELECT cp.id FROM public.client_products cp WHERE private.is_partner_for_client(auth.uid(), cp.client_id)
  ))
  OR (sale_id IS NOT NULL AND sale_id IN (
    SELECT s.id FROM public.sales s WHERE s.partner_id IN (SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))
  ))
);

DROP POLICY IF EXISTS "Referrers view related contracts" ON public.contracts;
CREATE POLICY "Referrers view related contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  (client_id IS NOT NULL AND private.is_referrer_for_client(auth.uid(), client_id))
  OR (client_product_id IS NOT NULL AND client_product_id IN (
    SELECT cp.id FROM public.client_products cp WHERE private.is_referrer_for_client(auth.uid(), cp.client_id)
  ))
  OR (sale_id IS NOT NULL AND sale_id IN (
    SELECT s.id FROM public.sales s WHERE s.referrer_id IN (SELECT r.id FROM public.referrers r WHERE r.user_id = auth.uid() OR lower(r.email) = lower(auth.jwt() ->> 'email'))
  ))
);

DROP POLICY IF EXISTS "Provider views delegated contracts (by demand)" ON public.contracts;
CREATE POLICY "Provider views delegated contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  (provider_id IN (SELECT sp.id FROM public.service_providers sp WHERE sp.user_id = auth.uid() OR lower(sp.email) = lower(auth.jwt() ->> 'email')))
  OR (client_product_id IS NOT NULL AND private.is_delegated_provider(auth.uid(), client_product_id))
);

-- Pagamentos: leitura financeira quando o registro pertence ao cliente/venda/demanda vinculada ao papel
DROP POLICY IF EXISTS "Partners view related payments" ON public.payments;
CREATE POLICY "Partners view related payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  (client_id IS NOT NULL AND private.is_partner_for_client(auth.uid(), client_id))
  OR (sale_id IS NOT NULL AND sale_id IN (SELECT s.id FROM public.sales s WHERE s.partner_id IN (SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email'))))
  OR (client_product_id IS NOT NULL AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_partner_for_client(auth.uid(), cp.client_id)))
);

DROP POLICY IF EXISTS "Referrers view related payments" ON public.payments;
CREATE POLICY "Referrers view related payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  (client_id IS NOT NULL AND private.is_referrer_for_client(auth.uid(), client_id))
  OR (sale_id IS NOT NULL AND sale_id IN (SELECT s.id FROM public.sales s WHERE s.referrer_id IN (SELECT r.id FROM public.referrers r WHERE r.user_id = auth.uid() OR lower(r.email) = lower(auth.jwt() ->> 'email'))))
  OR (client_product_id IS NOT NULL AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_referrer_for_client(auth.uid(), cp.client_id)))
);

DROP POLICY IF EXISTS "Collaborators view related payments" ON public.payments;
CREATE POLICY "Collaborators view related payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND (
    (client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), client_id))
    OR (sale_id IS NOT NULL AND sale_id IN (SELECT s.id FROM public.sales s WHERE s.collaborator_id = auth.uid()))
    OR (client_product_id IS NOT NULL AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE cp.responsible_employee_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Providers view related payments" ON public.payments;
CREATE POLICY "Providers view related payments"
ON public.payments
FOR SELECT
TO authenticated
USING (client_product_id IS NOT NULL AND private.is_delegated_provider(auth.uid(), client_product_id));

-- Vendas e splits: fallback por e-mail e colaborador vinculado
DROP POLICY IF EXISTS "Partner views own sales" ON public.sales;
CREATE POLICY "Partner views own sales"
ON public.sales
FOR SELECT
TO authenticated
USING (partner_id IN (SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "Referrers view own sales" ON public.sales;
CREATE POLICY "Referrers view own sales"
ON public.sales
FOR SELECT
TO authenticated
USING (referrer_id IN (SELECT r.id FROM public.referrers r WHERE r.user_id = auth.uid() OR lower(r.email) = lower(auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "Collaborators view own sales" ON public.sales;
CREATE POLICY "Collaborators view own sales"
ON public.sales
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'colaborador'::public.app_role) AND collaborator_id = auth.uid());

DROP POLICY IF EXISTS "Partner view own splits" ON public.commission_splits;
CREATE POLICY "Partner view own splits"
ON public.commission_splits
FOR SELECT
TO authenticated
USING ((beneficiary_type = 'partner'::public.beneficiary_type) AND beneficiary_id IN (SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "Referrer view own splits" ON public.commission_splits;
CREATE POLICY "Referrer view own splits"
ON public.commission_splits
FOR SELECT
TO authenticated
USING ((beneficiary_type = 'referrer'::public.beneficiary_type) AND beneficiary_id IN (SELECT r.id FROM public.referrers r WHERE r.user_id = auth.uid() OR lower(r.email) = lower(auth.jwt() ->> 'email')));

-- Relatórios, entregas, comentários e etapas de demandas relacionadas
DROP POLICY IF EXISTS "Partners view related status reports" ON public.client_product_status_reports;
CREATE POLICY "Partners view related status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING (client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_partner_for_client(auth.uid(), cp.client_id)));

DROP POLICY IF EXISTS "Referrers view related status reports" ON public.client_product_status_reports;
CREATE POLICY "Referrers view related status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING (client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_referrer_for_client(auth.uid(), cp.client_id)));

DROP POLICY IF EXISTS "Collaborators view related status reports" ON public.client_product_status_reports;
CREATE POLICY "Collaborators view related status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'colaborador'::public.app_role) AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE cp.responsible_employee_id = auth.uid() OR private.is_collaborator_for_client(auth.uid(), cp.client_id)));

DROP POLICY IF EXISTS "Partners view related demand deliveries" ON public.demand_deliveries;
CREATE POLICY "Partners view related demand deliveries"
ON public.demand_deliveries
FOR SELECT
TO authenticated
USING (client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_partner_for_client(auth.uid(), cp.client_id)));

DROP POLICY IF EXISTS "Referrers view related demand deliveries" ON public.demand_deliveries;
CREATE POLICY "Referrers view related demand deliveries"
ON public.demand_deliveries
FOR SELECT
TO authenticated
USING (client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_referrer_for_client(auth.uid(), cp.client_id)));

DROP POLICY IF EXISTS "Partners view visible product steps" ON public.client_product_steps;
CREATE POLICY "Partners view visible product steps"
ON public.client_product_steps
FOR SELECT
TO authenticated
USING (is_visible_to_client = true AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_partner_for_client(auth.uid(), cp.client_id)));

DROP POLICY IF EXISTS "Referrers view visible product steps" ON public.client_product_steps;
CREATE POLICY "Referrers view visible product steps"
ON public.client_product_steps
FOR SELECT
TO authenticated
USING (is_visible_to_client = true AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_referrer_for_client(auth.uid(), cp.client_id)));

DROP POLICY IF EXISTS "Partners view related demand comments" ON public.demand_comments;
CREATE POLICY "Partners view related demand comments"
ON public.demand_comments
FOR SELECT
TO authenticated
USING (visibility IN ('client'::public.comment_visibility, 'system'::public.comment_visibility) AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_partner_for_client(auth.uid(), cp.client_id)));

DROP POLICY IF EXISTS "Referrers view related demand comments" ON public.demand_comments;
CREATE POLICY "Referrers view related demand comments"
ON public.demand_comments
FOR SELECT
TO authenticated
USING (visibility IN ('client'::public.comment_visibility, 'system'::public.comment_visibility) AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_referrer_for_client(auth.uid(), cp.client_id)));

DROP POLICY IF EXISTS "Collaborators view assigned demand comments" ON public.demand_comments;
CREATE POLICY "Collaborators view assigned demand comments"
ON public.demand_comments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'colaborador'::public.app_role) AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE cp.responsible_employee_id = auth.uid() OR private.is_collaborator_for_client(auth.uid(), cp.client_id)));

-- Tasks relacionadas ao parceiro/prestador/cliente atribuído
DROP POLICY IF EXISTS "Partners view related tasks" ON public.tasks;
CREATE POLICY "Partners view related tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  (partner_id IN (SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid() OR lower(p.email) = lower(auth.jwt() ->> 'email')))
  OR (client_id IS NOT NULL AND private.is_partner_for_client(auth.uid(), client_id))
  OR (client_product_id IS NOT NULL AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE private.is_partner_for_client(auth.uid(), cp.client_id)))
);

DROP POLICY IF EXISTS "Collaborators view related tasks" ON public.tasks;
CREATE POLICY "Collaborators view related tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'colaborador'::public.app_role) AND ((assigned_to = auth.uid()) OR (client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), client_id)) OR (client_product_id IS NOT NULL AND client_product_id IN (SELECT cp.id FROM public.client_products cp WHERE cp.responsible_employee_id = auth.uid()))));

-- Índices para as leituras por vínculo ficarem rápidas
CREATE INDEX IF NOT EXISTS idx_contracts_client_product_id ON public.contracts(client_product_id);
CREATE INDEX IF NOT EXISTS idx_contracts_partner_id ON public.contracts(partner_id);
CREATE INDEX IF NOT EXISTS idx_contracts_provider_id ON public.contracts(provider_id);
CREATE INDEX IF NOT EXISTS idx_contracts_sale_id ON public.contracts(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_product_id ON public.payments(client_product_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_partner_id ON public.sales(partner_id);
CREATE INDEX IF NOT EXISTS idx_sales_referrer_id ON public.sales(referrer_id);
CREATE INDEX IF NOT EXISTS idx_sales_collaborator_id ON public.sales(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_client_products_responsible_provider_id ON public.client_products(responsible_provider_id);