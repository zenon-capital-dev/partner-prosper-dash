-- Final refinement of relationships and structures

-- 1. Leads to Partners relationship
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='partner_id') THEN
        ALTER TABLE public.leads ADD COLUMN partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Tasks linked to multiple entities
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='document_id') THEN
        ALTER TABLE public.tasks ADD COLUMN document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='contract_id') THEN
        ALTER TABLE public.tasks ADD COLUMN contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='payment_id') THEN
        ALTER TABLE public.tasks ADD COLUMN payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Payments linked to Client and Product
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='client_product_id') THEN
        ALTER TABLE public.payments ADD COLUMN client_product_id UUID REFERENCES public.client_products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Commissions linked to Partner, Client, and Product
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='client_id') THEN
        ALTER TABLE public.commissions ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='product_id') THEN
        ALTER TABLE public.commissions ADD COLUMN product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Add triggers for activity logging to other important tables
DROP TRIGGER IF EXISTS log_leads_activity ON public.leads;
CREATE TRIGGER log_leads_activity AFTER INSERT OR UPDATE OR DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_tasks_activity ON public.tasks;
CREATE TRIGGER log_tasks_activity AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_payments_activity ON public.payments;
CREATE TRIGGER log_payments_activity AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_commissions_activity ON public.commissions;
CREATE TRIGGER log_commissions_activity AFTER INSERT OR UPDATE OR DELETE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- 6. Ensure security for log_activity trigger function execution (not security definer, so it runs as invoker)
-- Already handled in previous step with search_path.
