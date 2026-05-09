-- 1. Create Enums for Task Management
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status_new') THEN
    CREATE TYPE task_status_new AS ENUM ('a_fazer', 'em_andamento', 'aguardando_terceiros', 'bloqueada', 'concluida', 'cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority_new') THEN
    CREATE TYPE task_priority_new AS ENUM ('baixa', 'normal', 'alta', 'urgente');
  END IF;
END $$;

-- 2. Enhance Tasks Table
-- We check if columns exist before adding them to avoid errors on re-run
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS priority task_priority_new DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS status_new task_status_new DEFAULT 'a_fazer',
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS client_product_id UUID REFERENCES public.client_products(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.service_providers(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 3. Migration logic for existing status/priority if needed (optional)
-- UPDATE public.tasks SET status_new = 'a_fazer' WHERE status_new IS NULL;

-- 4. Indexes for fast dashboard filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status_new);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);

-- 5. RLS Policies
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
CREATE POLICY "Admins can manage all tasks"
ON public.tasks FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Users can view assigned tasks" ON public.tasks;
CREATE POLICY "Users can view assigned tasks"
ON public.tasks FOR SELECT
USING (assigned_to = auth.uid());
