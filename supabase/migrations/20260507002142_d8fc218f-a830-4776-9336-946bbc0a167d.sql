-- Fix security linter issues by setting search_path for the log_activity function
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER AS $$
DECLARE
    entity_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        entity_id := OLD.id;
    ELSE
        entity_id := NEW.id;
    END IF;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        entity_id,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;
