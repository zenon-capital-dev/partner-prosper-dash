
-- Promove admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('dbebc38a-8691-4dc4-a644-869cac299c46', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Popula categorias se vazias
INSERT INTO public.product_categories (name, color, icon)
SELECT * FROM (VALUES
  ('Financeiro', '#10b981', 'TrendingUp'),
  ('Jurídico', '#6366f1', 'Scale'),
  ('Seguros', '#f59e0b', 'Shield'),
  ('Consultoria', '#ec4899', 'Briefcase')
) AS t(name, color, icon)
WHERE NOT EXISTS (SELECT 1 FROM public.product_categories);

-- Produtos exemplo
INSERT INTO public.products (name, description, category_id, base_price, default_commission_percent, active)
SELECT 'Crédito Empresarial', 'Linha de crédito para PJ', c.id, 5000, 15, true
FROM public.product_categories c WHERE c.name='Financeiro' AND NOT EXISTS (SELECT 1 FROM public.products);

INSERT INTO public.products (name, description, category_id, base_price, default_commission_percent, active)
SELECT 'Recuperação de Crédito', 'Cobrança e renegociação', c.id, 3500, 20, true
FROM public.product_categories c WHERE c.name='Financeiro' AND (SELECT COUNT(*) FROM public.products) < 2;

INSERT INTO public.products (name, description, category_id, base_price, default_commission_percent, active)
SELECT 'Consultoria Tributária', 'Planejamento fiscal completo', c.id, 4500, 18, true
FROM public.product_categories c WHERE c.name='Jurídico' AND (SELECT COUNT(*) FROM public.products) < 3;

INSERT INTO public.products (name, description, category_id, base_price, default_commission_percent, active)
SELECT 'Seguro Empresarial', 'Cobertura corporativa', c.id, 2800, 12, true
FROM public.product_categories c WHERE c.name='Seguros' AND (SELECT COUNT(*) FROM public.products) < 4;

-- Colunas faltantes em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Colunas faltantes em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_partner BOOLEAN NOT NULL DEFAULT true;

-- Timeline de cliente
CREATE TABLE IF NOT EXISTS public.client_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/Vendedor read timeline" ON public.client_timeline;
CREATE POLICY "Admin/Vendedor read timeline" ON public.client_timeline FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));

DROP POLICY IF EXISTS "Admin/Vendedor write timeline" ON public.client_timeline;
CREATE POLICY "Admin/Vendedor write timeline" ON public.client_timeline FOR INSERT
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));

-- Notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users mark own notifications" ON public.notifications;
CREATE POLICY "Users mark own notifications" ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin creates notifications" ON public.notifications;
CREATE POLICY "Admin creates notifications" ON public.notifications FOR INSERT
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Despesas
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'operacional',
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages expenses" ON public.expenses;
CREATE POLICY "Admin manages expenses" ON public.expenses FOR ALL
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_clients_search ON public.clients USING gin (to_tsvector('portuguese', coalesce(full_name,'')||' '||coalesce(company,'')||' '||coalesce(email,'')));
CREATE INDEX IF NOT EXISTS idx_partners_search ON public.partners USING gin (to_tsvector('portuguese', coalesce(full_name,'')||' '||coalesce(email,'')));
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products USING gin (to_tsvector('portuguese', coalesce(name,'')||' '||coalesce(description,'')));
CREATE INDEX IF NOT EXISTS idx_timeline_client ON public.client_timeline(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);
