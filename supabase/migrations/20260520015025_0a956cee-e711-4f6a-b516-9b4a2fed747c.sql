
-- 1) Estender handle_new_sale para criar comissões de referrer + collaborator
-- e não criar payment quando venda já nasce cancelada
CREATE OR REPLACE FUNCTION public.handle_new_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Comissão do parceiro principal
    IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent,0) > 0 THEN
        INSERT INTO public.commissions (
            partner_id, sale_id, client_id, product_id,
            amount, percent, sale_value,
            status, workflow_status, notes
        )
        VALUES (
            NEW.partner_id, NEW.id, NEW.client_id, NEW.product_id,
            ROUND((NEW.amount * NEW.commission_percent) / 100, 2),
            NEW.commission_percent,
            NEW.amount,
            'pendente',
            'aguardando_confirmacao',
            'Gerada automaticamente via venda ' || NEW.id
        );
    END IF;

    -- Comissão do indicador
    IF NEW.referrer_id IS NOT NULL AND COALESCE(NEW.referrer_percent,0) > 0 THEN
        INSERT INTO public.commissions (
            referrer_id, sale_id, client_id, product_id,
            amount, percent, sale_value,
            status, workflow_status, notes
        )
        VALUES (
            NEW.referrer_id, NEW.id, NEW.client_id, NEW.product_id,
            ROUND((NEW.amount * NEW.referrer_percent) / 100, 2),
            NEW.referrer_percent,
            NEW.amount,
            'pendente',
            'aguardando_confirmacao',
            'Indicação - venda ' || NEW.id
        );
    END IF;

    -- Comissão do colaborador
    IF NEW.collaborator_id IS NOT NULL AND COALESCE(NEW.collaborator_percent,0) > 0 THEN
        INSERT INTO public.commissions (
            collaborator_id, sale_id, client_id, product_id,
            amount, percent, sale_value,
            status, workflow_status, notes
        )
        VALUES (
            NEW.collaborator_id, NEW.id, NEW.client_id, NEW.product_id,
            ROUND((NEW.amount * NEW.collaborator_percent) / 100, 2),
            NEW.collaborator_percent,
            NEW.amount,
            'pendente',
            'aguardando_confirmacao',
            'Colaborador - venda ' || NEW.id
        );
    END IF;

    -- Fatura só para vendas não-canceladas
    IF NEW.status::text <> 'cancelada' THEN
        INSERT INTO public.payments (client_id, sale_id, amount, status, due_date, description)
        VALUES (NEW.client_id, NEW.id, NEW.amount, 'pendente',
                COALESCE(NEW.payment_due_date, CURRENT_DATE + INTERVAL '3 days'),
                'Fatura gerada via venda: ' || NEW.id);
    END IF;

    -- Log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, metadata)
    VALUES ('CREATE_SALE', 'sales', NEW.id, NEW.created_by,
            jsonb_build_object('amount', NEW.amount, 'client_id', NEW.client_id));

    -- Promove cliente prospecto a ativo
    UPDATE public.clients SET status = 'ativo'
    WHERE id = NEW.client_id AND status = 'prospecto';

    RETURN NEW;
END;
$function$;

-- 2) sync_commission_split_status: sincronizar todos splits pelo sale_id
CREATE OR REPLACE FUNCTION public.sync_commission_split_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_btype text;
  v_bid uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Identifica o beneficiário desta comissão
    IF NEW.partner_id IS NOT NULL THEN
      v_btype := 'partner'; v_bid := NEW.partner_id;
    ELSIF NEW.referrer_id IS NOT NULL THEN
      v_btype := 'referrer'; v_bid := NEW.referrer_id;
    ELSIF NEW.collaborator_id IS NOT NULL THEN
      v_btype := 'collaborator'; v_bid := NEW.collaborator_id;
    END IF;

    IF v_btype IS NOT NULL AND v_bid IS NOT NULL THEN
      UPDATE public.commission_splits
      SET status = NEW.status::text::split_status,
          paid_at = NEW.paid_at,
          updated_at = now()
      WHERE sale_id = NEW.sale_id
        AND beneficiary_type = v_btype
        AND beneficiary_id = v_bid;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
