CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TYPE public.partner_type AS ENUM ('parceiro', 'indicador');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS partner_type public.partner_type NOT NULL DEFAULT 'parceiro';

DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM ('previsto', 'ativo', 'em_andamento', 'concluido', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_id UUID NOT NULL,
  product_id UUID,
  partner_id UUID,
  status public.project_status NOT NULL DEFAULT 'previsto',
  amount NUMERIC NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/vendedor manage projects" ON public.projects;
CREATE POLICY "Admin/vendedor manage projects" ON public.projects
  FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'vendedor'::app_role));

DROP POLICY IF EXISTS "Client view own projects" ON public.projects;
CREATE POLICY "Client view own projects" ON public.projects
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner view own projects" ON public.projects;
CREATE POLICY "Partner view own projects" ON public.projects
  FOR SELECT USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_start ON public.projects(start_date);
