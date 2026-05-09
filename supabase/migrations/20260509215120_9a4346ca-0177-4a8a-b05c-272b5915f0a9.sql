-- Ensure audit_logs table is correctly structured
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add ip_address to activity_logs if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'ip_address') THEN
        ALTER TABLE public.activity_logs ADD COLUMN ip_address TEXT;
    END IF;
END $$;

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create or update the log_activity function
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER AS $$
DECLARE
    entity_id UUID;
    v_user_id UUID;
    v_ip_address TEXT;
BEGIN
    -- Get user ID
    v_user_id := auth.uid();
    
    -- Try to get IP address from PostgREST headers
    BEGIN
        v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
        IF v_ip_address IS NULL THEN
            v_ip_address := current_setting('request.headers', true)::json->>'x-real-ip';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;

    -- Determine entity ID
    IF (TG_OP = 'DELETE') THEN
        entity_id := OLD.id;
    ELSE
        entity_id := NEW.id;
    END IF;

    -- Insert into audit_logs
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
    VALUES (
        v_user_id,
        TG_OP,
        TG_TABLE_NAME,
        entity_id,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        v_ip_address
    );
    
    -- Insert into activity_logs for backward compatibility
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
    VALUES (
        v_user_id,
        TG_OP,
        TG_TABLE_NAME,
        entity_id,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        v_ip_address
    ) ON CONFLICT DO NOTHING;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to missing tables
DROP TRIGGER IF EXISTS log_comments_activity ON public.demand_comments;
CREATE TRIGGER log_comments_activity
AFTER INSERT OR UPDATE OR DELETE ON public.demand_comments
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_assignments_activity ON public.service_assignments;
CREATE TRIGGER log_assignments_activity
AFTER INSERT OR UPDATE OR DELETE ON public.service_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Re-apply triggers to ensure they use the updated function
DROP TRIGGER IF EXISTS log_clients_activity ON public.clients;
CREATE TRIGGER log_clients_activity AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_client_products_activity ON public.client_products;
CREATE TRIGGER log_client_products_activity AFTER INSERT OR UPDATE OR DELETE ON public.client_products FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_documents_activity ON public.documents;
CREATE TRIGGER log_documents_activity AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_payments_activity ON public.payments;
CREATE TRIGGER log_payments_activity AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_commissions_activity ON public.commissions;
CREATE TRIGGER log_commissions_activity AFTER INSERT OR UPDATE OR DELETE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_contracts_activity ON public.contracts;
CREATE TRIGGER log_contracts_activity AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.log_activity();
