
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

    -- Fatura (pagamento) do cliente
    INSERT INTO public.payments (client_id, sale_id, amount, status, due_date, description)
    VALUES (NEW.client_id, NEW.id, NEW.amount, 'pendente', CURRENT_DATE + INTERVAL '3 days', 'Fatura gerada via venda: ' || NEW.id);

    -- Log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, metadata)
    VALUES ('CREATE_SALE', 'sales', NEW.id, NEW.created_by, jsonb_build_object('amount', NEW.amount, 'client_id', NEW.client_id));

    -- Promove cliente prospecto a ativo
    UPDATE public.clients SET status = 'ativo' WHERE id = NEW.client_id AND status = 'prospecto';

    RETURN NEW;
END;
$function$;

-- Backfill comissões em vendas antigas sem comissão
INSERT INTO public.commissions (
    partner_id, sale_id, client_id, product_id,
    amount, percent, sale_value,
    status, workflow_status, notes
)
SELECT
    s.partner_id, s.id, s.client_id, s.product_id,
    ROUND((s.amount * s.commission_percent) / 100, 2),
    s.commission_percent,
    s.amount,
    'pendente',
    'aguardando_confirmacao',
    'Backfill - gerada para venda existente ' || s.id
FROM public.sales s
WHERE s.partner_id IS NOT NULL
  AND COALESCE(s.commission_percent,0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.commissions c
    WHERE c.sale_id = s.id AND c.partner_id = s.partner_id
  );
