CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    entity_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        entity_id := OLD.id;
    ELSE
        entity_id := NEW.id;
    END IF;

    -- Popular audit_logs (tabela solicitada para a página de auditoria)
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        entity_id,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    );
    
    -- Manter activity_logs por compatibilidade
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
$function$;

-- Adicionar gatilhos em tabelas que ainda não tinham auditoria
DROP TRIGGER IF EXISTS log_sales_activity ON public.sales;
CREATE TRIGGER log_sales_activity AFTER INSERT OR UPDATE OR DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_partners_activity ON public.partners;
CREATE TRIGGER log_partners_activity AFTER INSERT OR UPDATE OR DELETE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_client_products_activity ON public.client_products;
CREATE TRIGGER log_client_products_activity AFTER INSERT OR UPDATE OR DELETE ON public.client_products FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS log_commissions_activity ON public.commissions;
CREATE TRIGGER log_commissions_activity AFTER INSERT OR UPDATE OR DELETE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.log_activity();
