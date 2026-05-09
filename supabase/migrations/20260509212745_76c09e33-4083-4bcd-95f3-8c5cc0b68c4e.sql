-- 1. Create Comment Types Enum
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comment_visibility') THEN
    CREATE TYPE comment_visibility AS ENUM ('internal', 'provider', 'client', 'system');
  END IF;
END $$;

-- 2. Create Demand Comments Table
CREATE TABLE IF NOT EXISTS public.demand_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_product_id UUID NOT NULL REFERENCES public.client_products(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  visibility comment_visibility NOT NULL DEFAULT 'client',
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.demand_comments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- ADMIN: Can see everything
CREATE POLICY "Admins can see all demand comments"
ON public.demand_comments FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- PRESTADOR: Can see 'provider', 'client', and 'system' comments for their assigned demands
CREATE POLICY "Providers can see allowed demand comments"
ON public.demand_comments FOR SELECT
USING (
  visibility IN ('provider', 'client', 'system')
  AND client_product_id IN (
    SELECT id FROM public.client_products WHERE service_provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Providers can insert comments to assigned demands"
ON public.demand_comments FOR INSERT
WITH CHECK (
  visibility IN ('provider', 'client')
  AND client_product_id IN (
    SELECT id FROM public.client_products WHERE service_provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = auth.uid()
    )
  )
);

-- CLIENTE: Can see ONLY 'client' and 'system' comments for their own demands
CREATE POLICY "Clients can see allowed demand comments"
ON public.demand_comments FOR SELECT
USING (
  visibility IN ('client', 'system')
  AND client_product_id IN (
    SELECT id FROM public.client_products WHERE client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Clients can insert comments to their demands"
ON public.demand_comments FOR INSERT
WITH CHECK (
  visibility = 'client'
  AND client_product_id IN (
    SELECT id FROM public.client_products WHERE client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  )
);

-- 5. Trigger for updated_at
CREATE TRIGGER update_demand_comments_updated_at
BEFORE UPDATE ON public.demand_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_demand_comments_client_product_id ON public.demand_comments(client_product_id);
CREATE INDEX IF NOT EXISTS idx_demand_comments_visibility ON public.demand_comments(visibility);
