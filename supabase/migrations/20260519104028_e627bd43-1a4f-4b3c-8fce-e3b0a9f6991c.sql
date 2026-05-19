-- Corrige acesso do colaborador aos dados atribuídos a ele
-- O colaborador pode ver clientes onde ele foi marcado diretamente
-- ou clientes que possuem demandas sob sua responsabilidade.
DROP POLICY IF EXISTS "Colaboradores view clients" ON public.clients;
CREATE POLICY "Colaboradores view assigned clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND (
    collaborator_id = auth.uid()
    OR id IN (
      SELECT cp.client_id
      FROM public.client_products cp
      WHERE cp.responsible_employee_id = auth.uid()
    )
  )
);

-- Amplia a leitura de demandas: além da demanda com responsible_employee_id,
-- também permite ver demandas de clientes marcados com esse colaborador.
DROP POLICY IF EXISTS "Colaboradores view assigned demands" ON public.client_products;
CREATE POLICY "Colaboradores view assigned demands"
ON public.client_products
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND (
    responsible_employee_id = auth.uid()
    OR client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.collaborator_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Colaboradores update assigned demands" ON public.client_products;
CREATE POLICY "Colaboradores update assigned demands"
ON public.client_products
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND responsible_employee_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND responsible_employee_id = auth.uid()
);

-- Documentos seguem a mesma lógica da demanda/cliente atribuídos.
DROP POLICY IF EXISTS "Colaboradores view assigned demand documents" ON public.documents;
CREATE POLICY "Colaboradores view assigned demand documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND (
    client_product_id IN (
      SELECT cp.id
      FROM public.client_products cp
      WHERE cp.responsible_employee_id = auth.uid()
         OR cp.client_id IN (
           SELECT c.id FROM public.clients c WHERE c.collaborator_id = auth.uid()
         )
    )
    OR client_id IN (
      SELECT c.id FROM public.clients c WHERE c.collaborator_id = auth.uid()
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_clients_collaborator_id ON public.clients(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_client_products_responsible_employee_id ON public.client_products(responsible_employee_id);
CREATE INDEX IF NOT EXISTS idx_client_products_client_id ON public.client_products(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_product_id ON public.documents(client_product_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents(client_id);