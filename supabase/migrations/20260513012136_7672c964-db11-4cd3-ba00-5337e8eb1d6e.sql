
-- 1) Tarefas: prestador delegado pode ver e atualizar tarefas da demanda dele
DROP POLICY IF EXISTS "Providers view delegated demand tasks" ON public.tasks;
CREATE POLICY "Providers view delegated demand tasks"
  ON public.tasks FOR SELECT
  USING (
    client_product_id IS NOT NULL
    AND public.is_delegated_provider(auth.uid(), client_product_id)
  );

DROP POLICY IF EXISTS "Providers update delegated demand tasks" ON public.tasks;
CREATE POLICY "Providers update delegated demand tasks"
  ON public.tasks FOR UPDATE
  USING (
    client_product_id IS NOT NULL
    AND public.is_delegated_provider(auth.uid(), client_product_id)
  )
  WITH CHECK (
    client_product_id IS NOT NULL
    AND public.is_delegated_provider(auth.uid(), client_product_id)
  );

-- 2) Documentos: remove policy legada que duplica acesso de prestador
--    (a regra "Provider views delegated documents" já cobre o caso correto)
DROP POLICY IF EXISTS "Providers view assigned product documents" ON public.documents;

-- 3) client_products: consolidar policies duplicadas
DROP POLICY IF EXISTS "Admins manage all products" ON public.client_products;
DROP POLICY IF EXISTS "Admins total access" ON public.client_products;
DROP POLICY IF EXISTS "Clients view own products" ON public.client_products;
DROP POLICY IF EXISTS "Providers access assigned demands" ON public.client_products;
DROP POLICY IF EXISTS "Providers view assigned products" ON public.client_products;
DROP POLICY IF EXISTS "Providers update assigned products" ON public.client_products;
-- Mantidas:
--   "Admins can manage client products"  (admin/admin_secondary/colaborador — ALL)
--   "Clients access their own demands"   (SELECT por client_id ou company_id)
--   "Partners access their referrals"    (SELECT por partner_id/referrer_id)
--   "Provider views delegated products"  (SELECT delegado)
--   "Provider updates delegated products" (UPDATE delegado)

-- 4) commissions: limpar duplicata
DROP POLICY IF EXISTS "Partner views own commissions" ON public.commissions;
DROP POLICY IF EXISTS "Admins view all commissions" ON public.commissions;
DROP POLICY IF EXISTS "Admins total access" ON public.commissions;
-- Mantidas: "Admins manage commissions" e "Partners view own commissions"

-- 5) commission_splits: limpar duplicata
DROP POLICY IF EXISTS "Admins total access" ON public.commission_splits;
-- Mantidas: "Admin manage splits", "Admin/vendedor view splits",
--           "Partner view own splits", "Referrer view own splits", "Collaborator view own splits"

-- 6) client_product_steps: limpar duplicata redundante
DROP POLICY IF EXISTS "Clients view visible own product steps" ON public.client_product_steps;
DROP POLICY IF EXISTS "Providers can manage assigned product steps" ON public.client_product_steps;
-- Mantidas: "Admins can do everything on steps", "Clients can view visible product steps",
--           "Internal team manages client product steps", "Providers manage delegated product steps"

-- 7) client_product_status_reports: limpar duplicata
DROP POLICY IF EXISTS "Client views own product reports" ON public.client_product_status_reports;
-- Mantidas: "Admins manage status reports", "Clients see their product reports",
--           "Providers create/update/delete/view own status reports"

-- 8) tasks: limpar duplicatas administrativas
DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins total access" ON public.tasks;
DROP POLICY IF EXISTS "Users view assigned tasks" ON public.tasks;
-- Mantidas: "Admins can do everything on tasks" (admin/admin_secondary/colaborador),
--           "Users can view assigned tasks" (assigned_to = auth.uid()),
--           e as duas novas para prestador delegado

-- 9) documents: limpar duplicatas (mantendo as policies semanticamente corretas)
DROP POLICY IF EXISTS "Admins total access" ON public.documents;
DROP POLICY IF EXISTS "Client views own documents" ON public.documents;
DROP POLICY IF EXISTS "Clients can upload requested documents" ON public.documents;
-- Mantidas:
--   "Admins/vendedores manage documents"
--   "Admins/vendedores view all documents"
--   "Clients view own documents"  (cobre client_id OU admin)
--   "Client uploads own documents" (UPDATE pelo cliente)
--   "Clients can update rejected documents"
--   "Provider views delegated documents"
