-- 1) client_products: tirar colaborador do bypass de admin
DROP POLICY IF EXISTS "Admins can manage client products" ON public.client_products;
CREATE POLICY "Admins can manage client products"
ON public.client_products
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role = ANY (ARRAY['admin'::public.app_role, 'admin_secondary'::public.app_role])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role = ANY (ARRAY['admin'::public.app_role, 'admin_secondary'::public.app_role])
));

-- 2) colaborador vê e atualiza apenas as próprias demandas
DROP POLICY IF EXISTS "Colaboradores view assigned demands" ON public.client_products;
CREATE POLICY "Colaboradores view assigned demands"
ON public.client_products
FOR SELECT
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND responsible_employee_id = auth.uid()
);

DROP POLICY IF EXISTS "Colaboradores update assigned demands" ON public.client_products;
CREATE POLICY "Colaboradores update assigned demands"
ON public.client_products
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND responsible_employee_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND responsible_employee_id = auth.uid()
);

-- 3) tasks: tirar colaborador do bypass de admin
DROP POLICY IF EXISTS "Admins can do everything on tasks" ON public.tasks;
CREATE POLICY "Admins can do everything on tasks"
ON public.tasks
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role = ANY (ARRAY['admin'::public.app_role, 'admin_secondary'::public.app_role])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role = ANY (ARRAY['admin'::public.app_role, 'admin_secondary'::public.app_role])
));

-- 4) colaborador atualiza tarefas dele (SELECT já existe via "Users can view assigned tasks")
DROP POLICY IF EXISTS "Users update own assigned tasks" ON public.tasks;
CREATE POLICY "Users update own assigned tasks"
ON public.tasks
FOR UPDATE
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

-- 5) documents: colaborador vê documentos das demandas dele
DROP POLICY IF EXISTS "Colaboradores view assigned demand documents" ON public.documents;
CREATE POLICY "Colaboradores view assigned demand documents"
ON public.documents
FOR SELECT
USING (
  public.has_role(auth.uid(), 'colaborador'::public.app_role)
  AND client_product_id IN (
    SELECT id FROM public.client_products WHERE responsible_employee_id = auth.uid()
  )
);