-- 1. Unique constraint for documents in clients
CREATE UNIQUE INDEX IF NOT EXISTS clients_document_unique_idx ON public.clients (document) WHERE document IS NOT NULL AND document != '';

-- 2. Unique constraint for email in profiles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles (email) WHERE email IS NOT NULL AND email != '';

-- 3. Missing indexes
CREATE INDEX IF NOT EXISTS idx_client_products_service_provider_id ON public.client_products(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_client_products_client_id ON public.client_products(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_product_id ON public.tasks(client_product_id);
CREATE INDEX IF NOT EXISTS idx_commissions_client_product_id ON public.commissions(client_product_id);

-- 4. Standardize Financial Status
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'payment_status') THEN
        UPDATE public.clients SET payment_status = 'pago' WHERE payment_status = 'paga';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commissions' AND column_name = 'status') THEN
        UPDATE public.commissions SET status = 'pago' WHERE status = 'paga';
    END IF;
END $$;

-- 5. Security: Revoke public execution safely
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public'
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC;', func_record.schema, func_record.name, func_record.args);
    END LOOP;
END $$;
