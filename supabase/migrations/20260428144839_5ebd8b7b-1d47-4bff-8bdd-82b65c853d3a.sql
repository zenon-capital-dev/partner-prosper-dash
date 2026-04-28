-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'parceiro', 'cliente');
CREATE TYPE public.sale_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE public.commission_status AS ENUM ('pendente', 'pago', 'cancelado');
CREATE TYPE public.document_status AS ENUM ('solicitado', 'enviado', 'aprovado', 'rejeitado');
CREATE TYPE public.client_status AS ENUM ('ativo', 'inativo', 'prospecto');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

-- PRODUCT CATEGORIES
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  base_price NUMERIC(14,2) DEFAULT 0,
  default_commission_percent NUMERIC(5,2) DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- PARTNERS
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  pix_key TEXT,
  commission_percent NUMERIC(5,2) DEFAULT 10,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  status public.client_status NOT NULL DEFAULT 'ativo',
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- SALES
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_percent NUMERIC(5,2) DEFAULT 10,
  status public.sale_status NOT NULL DEFAULT 'pendente',
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- COMMISSIONS
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  percent NUMERIC(5,2) NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'pendente',
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- DOCUMENTS
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status public.document_status NOT NULL DEFAULT 'solicitado',
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ACTIVITIES (log)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- ============= RLS POLICIES =============

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- product_categories (everyone authenticated can read, admin manages)
CREATE POLICY "Authenticated can read categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.product_categories FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- products
CREATE POLICY "Authenticated can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage products" ON public.products FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- partners
CREATE POLICY "Admins view all partners" ON public.partners FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Partner views own" ON public.partners FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins manage partners" ON public.partners FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- clients
CREATE POLICY "Admins/vendedores view all clients" ON public.clients FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Partner views referred clients" ON public.clients FOR SELECT USING (
  partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
);
CREATE POLICY "Client views own record" ON public.clients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins/vendedores manage clients" ON public.clients FOR ALL USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor')) WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'));

-- sales
CREATE POLICY "Admins/vendedores view all sales" ON public.sales FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Partner views own sales" ON public.sales FOR SELECT USING (
  partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
);
CREATE POLICY "Client views own sales" ON public.sales FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY "Admins/vendedores manage sales" ON public.sales FOR ALL USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor')) WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'));

-- commissions
CREATE POLICY "Admins view all commissions" ON public.commissions FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Partner views own commissions" ON public.commissions FOR SELECT USING (
  partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage commissions" ON public.commissions FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- documents
CREATE POLICY "Admins/vendedores view all documents" ON public.documents FOR SELECT USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Client views own documents" ON public.documents FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
CREATE POLICY "Admins/vendedores manage documents" ON public.documents FOR ALL USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor')) WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Client uploads own documents" ON public.documents FOR UPDATE USING (
  client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- activities
CREATE POLICY "Admins view all activities" ON public.activities FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users view own activities" ON public.activities FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Authenticated can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============= TRIGGERS =============

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_partners_updated BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_commissions_updated BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- auto-create commission on sale insert
CREATE OR REPLACE FUNCTION public.handle_new_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_percent NUMERIC(5,2);
BEGIN
  IF NEW.partner_id IS NOT NULL THEN
    v_percent := COALESCE(NEW.commission_percent, 10);
    INSERT INTO public.commissions (sale_id, partner_id, amount, percent, status)
    VALUES (NEW.id, NEW.partner_id, ROUND(NEW.amount * v_percent / 100, 2), v_percent, 'pendente');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_sale_created
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_sale();

-- ============= SEED CATEGORIES =============
INSERT INTO public.product_categories (name, slug, color, icon) VALUES
  ('Financeiro', 'financeiro', '#10b981', 'DollarSign'),
  ('Jurídico', 'juridico', '#6366f1', 'Scale'),
  ('Seguros', 'seguros', '#f59e0b', 'Shield'),
  ('Consultoria', 'consultoria', '#ec4899', 'Briefcase');

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read documents bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated can upload to documents bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated can update own uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid() = owner);

CREATE POLICY "Authenticated can delete own uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (auth.uid() = owner OR public.is_admin(auth.uid())));