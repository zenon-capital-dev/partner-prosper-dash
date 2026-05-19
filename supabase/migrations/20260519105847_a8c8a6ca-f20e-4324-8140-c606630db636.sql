-- Centraliza a regra de vínculo do colaborador com cliente e demanda
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

CREATE OR REPLACE FUNCTION private.is_collaborator_for_client_product(_user_id uuid, _client_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_products cp
    LEFT JOIN public.clients c ON c.id = cp.client_id
    WHERE cp.id = _client_product_id
      AND (
        cp.responsible_employee_id = _user_id
        OR c.collaborator_id = _user_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.is_collaborator_for_sale(_user_id uuid, _sale_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sales s
    WHERE s.id = _sale_id
      AND (
        s.collaborator_id = _user_id
        OR (s.client_id IS NOT NULL AND private.is_collaborator_for_client(_user_id, s.client_id))
      )
  );
$$;

-- CLIENTES / DEMANDAS
DROP POLICY IF EXISTS "Colaboradores view assigned clients" ON public.clients;
CREATE POLICY "Colaboradores view assigned clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND private.is_collaborator_for_client(auth.uid(), id)
);

DROP POLICY IF EXISTS "Colaboradores view assigned demands" ON public.client_products;
CREATE POLICY "Colaboradores view assigned demands"
ON public.client_products
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND private.is_collaborator_for_client_product(auth.uid(), id)
);

DROP POLICY IF EXISTS "Colaboradores update assigned demands" ON public.client_products;
CREATE POLICY "Colaboradores update assigned demands"
ON public.client_products
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND private.is_collaborator_for_client_product(auth.uid(), id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND private.is_collaborator_for_client_product(auth.uid(), id)
);

-- EMPRESAS DO CLIENTE: remove gestão ampla de colaborador e libera só leitura vinculada
DROP POLICY IF EXISTS "Internal team manages companies" ON public.companies;
CREATE POLICY "Admins and vendors manage companies"
ON public.companies
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role));

DROP POLICY IF EXISTS "Collaborators view related companies" ON public.companies;
CREATE POLICY "Collaborators view related companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND private.is_collaborator_for_client(auth.uid(), client_id)
);

-- DOCUMENTOS E VERSÕES
DROP POLICY IF EXISTS "Colaboradores view assigned demand documents" ON public.documents;
CREATE POLICY "Colaboradores view assigned demand documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND (
    (client_product_id IS NOT NULL AND private.is_collaborator_for_client_product(auth.uid(), client_product_id))
    OR (client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), client_id))
    OR (sale_id IS NOT NULL AND private.is_collaborator_for_sale(auth.uid(), sale_id))
  )
);

DROP POLICY IF EXISTS "Internal team manages document versions" ON public.document_versions;
CREATE POLICY "Admins and vendors manage document versions"
ON public.document_versions
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role));

DROP POLICY IF EXISTS "Collaborators view related document versions" ON public.document_versions;
CREATE POLICY "Collaborators view related document versions"
ON public.document_versions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND document_id IN (
    SELECT d.id
    FROM public.documents d
    WHERE
      (d.client_product_id IS NOT NULL AND private.is_collaborator_for_client_product(auth.uid(), d.client_product_id))
      OR (d.client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), d.client_id))
      OR (d.sale_id IS NOT NULL AND private.is_collaborator_for_sale(auth.uid(), d.sale_id))
  )
);

-- TAREFAS
DROP POLICY IF EXISTS "Collaborators view related tasks" ON public.tasks;
CREATE POLICY "Collaborators view related tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND (
    assigned_to = auth.uid()
    OR (client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), client_id))
    OR (client_product_id IS NOT NULL AND private.is_collaborator_for_client_product(auth.uid(), client_product_id))
  )
);

DROP POLICY IF EXISTS "Users update own assigned tasks" ON public.tasks;
CREATE POLICY "Users update own assigned tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

-- VENDAS
DROP POLICY IF EXISTS "Collaborators view own sales" ON public.sales;
CREATE POLICY "Collaborators view own sales"
ON public.sales
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND (
    collaborator_id = auth.uid()
    OR (client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), client_id))
  )
);

-- PAGAMENTOS: remove gestão ampla de colaborador e libera só vínculos
DROP POLICY IF EXISTS "Internal team manages payments" ON public.payments;
CREATE POLICY "Admins and vendors manage payments"
ON public.payments
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role));

DROP POLICY IF EXISTS "Collaborators view related payments" ON public.payments;
CREATE POLICY "Collaborators view related payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND (
    (client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), client_id))
    OR (sale_id IS NOT NULL AND private.is_collaborator_for_sale(auth.uid(), sale_id))
    OR (client_product_id IS NOT NULL AND private.is_collaborator_for_client_product(auth.uid(), client_product_id))
  )
);

-- CONTRATOS: remove gestão ampla de colaborador e libera só leitura vinculada
DROP POLICY IF EXISTS "Internal team manages contracts" ON public.contracts;
CREATE POLICY "Admins and vendors manage contracts"
ON public.contracts
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role));

DROP POLICY IF EXISTS "Collaborators view related contracts" ON public.contracts;
CREATE POLICY "Collaborators view related contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND (
    (client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), client_id))
    OR (client_product_id IS NOT NULL AND private.is_collaborator_for_client_product(auth.uid(), client_product_id))
    OR (sale_id IS NOT NULL AND private.is_collaborator_for_sale(auth.uid(), sale_id))
  )
);

-- HISTÓRICO DE CONTRATOS vinculado
DROP POLICY IF EXISTS "Admin/Vendedor manage contract history" ON public.contract_history;
CREATE POLICY "Admin/Vendedor manage contract history"
ON public.contract_history
FOR ALL
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role));

DROP POLICY IF EXISTS "Collaborators view related contract history" ON public.contract_history;
CREATE POLICY "Collaborators view related contract history"
ON public.contract_history
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND contract_id IN (
    SELECT c.id
    FROM public.contracts c
    WHERE
      (c.client_id IS NOT NULL AND private.is_collaborator_for_client(auth.uid(), c.client_id))
      OR (c.client_product_id IS NOT NULL AND private.is_collaborator_for_client_product(auth.uid(), c.client_product_id))
      OR (c.sale_id IS NOT NULL AND private.is_collaborator_for_sale(auth.uid(), c.sale_id))
  )
);

-- RELATÓRIOS DE STATUS: mantém leitura vinculada e não deixa colaborador global
DROP POLICY IF EXISTS "Collaborators view related status reports" ON public.client_product_status_reports;
CREATE POLICY "Collaborators view related status reports"
ON public.client_product_status_reports
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND private.is_collaborator_for_client_product(auth.uid(), client_product_id)
);

-- ALERTAS FINANCEIROS: colaborador não vê alertas globais
DROP POLICY IF EXISTS "Staff view financial alerts" ON public.financial_alerts;
CREATE POLICY "Admins and vendors view financial alerts"
ON public.financial_alerts
FOR SELECT
TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role));

DROP POLICY IF EXISTS "Staff create financial alerts" ON public.financial_alerts;
CREATE POLICY "Admins and vendors create financial alerts"
ON public.financial_alerts
FOR INSERT
TO authenticated
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'vendedor'::public.app_role));

-- Índices de apoio para vínculo e performance
CREATE INDEX IF NOT EXISTS idx_clients_collaborator_id ON public.clients(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_client_products_responsible_employee_id ON public.client_products(responsible_employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_collaborator_id ON public.sales(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);