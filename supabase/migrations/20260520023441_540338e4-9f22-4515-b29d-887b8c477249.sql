-- Fix 1: log_lead_change usava colunas inexistentes (new_data, old_data)
-- A tabela lead_history tem: action, description, metadata
CREATE OR REPLACE FUNCTION public.log_lead_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_history (lead_id, action, description, metadata, created_by)
    VALUES (NEW.id, 'created', 'Lead criado', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.lead_history (lead_id, action, description, metadata, created_by)
      VALUES (
        NEW.id,
        'status_changed',
        'Status: ' || COALESCE(OLD.status::text,'—') || ' → ' || COALESCE(NEW.status::text,'—'),
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
        auth.uid()
      );
    END IF;
    IF NEW.responsible_id IS DISTINCT FROM OLD.responsible_id THEN
      INSERT INTO public.lead_history (lead_id, action, description, metadata, created_by)
      VALUES (
        NEW.id,
        'reassigned',
        'Responsável alterado',
        jsonb_build_object('old_responsible_id', OLD.responsible_id, 'new_responsible_id', NEW.responsible_id),
        auth.uid()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix 2: handle_new_sale referenciava NEW.payment_due_date (campo inexistente)
CREATE OR REPLACE FUNCTION public.handle_new_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent,0) > 0 THEN
        INSERT INTO public.commissions (
            partner_id, sale_id, client_id, product_id,
            amount, percent, sale_value,
            status, workflow_status, notes
        )
        VALUES (
            NEW.partner_id, NEW.id, NEW.client_id, NEW.product_id,
            ROUND((NEW.amount * NEW.commission_percent) / 100, 2),
            NEW.commission_percent, NEW.amount,
            'pendente', 'aguardando_confirmacao',
            'Gerada automaticamente via venda ' || NEW.id
        );
    END IF;

    IF NEW.status::text <> 'cancelada' THEN
        INSERT INTO public.payments (
            client_id, sale_id, amount, status, due_date, description,
            partner_id, referrer_id, collaborator_id
        )
        VALUES (
            NEW.client_id, NEW.id, NEW.amount, 'pendente',
            CURRENT_DATE + INTERVAL '3 days',
            'Fatura gerada via venda: ' || NEW.id,
            NEW.partner_id, NEW.referrer_id, NEW.collaborator_id
        );
    END IF;

    INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, metadata)
    VALUES ('CREATE_SALE', 'sales', NEW.id, NEW.created_by,
            jsonb_build_object('amount', NEW.amount, 'client_id', NEW.client_id));

    UPDATE public.clients SET status = 'ativo'
    WHERE id = NEW.client_id AND status = 'prospecto';

    RETURN NEW;
END;
$function$;