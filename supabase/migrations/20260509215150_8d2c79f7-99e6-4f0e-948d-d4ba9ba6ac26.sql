CREATE OR REPLACE FUNCTION public.set_audit_ip()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ip_address IS NULL THEN
        BEGIN
            NEW.ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
            IF NEW.ip_address IS NULL THEN
                NEW.ip_address := current_setting('request.headers', true)::json->>'x-real-ip';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_logs_ip ON public.audit_logs;
CREATE TRIGGER tr_audit_logs_ip
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.set_audit_ip();
