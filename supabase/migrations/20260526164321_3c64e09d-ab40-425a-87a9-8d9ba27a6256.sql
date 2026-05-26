-- Add referrer_id and collaborator_id to commissions table
ALTER TABLE public.commissions 
ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES public.referrers(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update the handle_new_sale function to handle all commission types
CREATE OR REPLACE FUNCTION public.handle_new_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Commission for Partner
    IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent, 0) > 0 THEN
        INSERT INTO public.commissions (
            partner_id, sale_id, client_id, product_id,
            amount, percent, sale_value,
            status, workflow_status, notes, commission_type
        )
        VALUES (
            NEW.partner_id, NEW.id, NEW.client_id, NEW.product_id,
            ROUND((NEW.amount * NEW.commission_percent) / 100, 2),
            NEW.commission_percent, NEW.amount,
            'pendente', 'aguardando_confirmacao',
            'Comissão de Parceiro gerada via venda ' || NEW.id,
            'percentual'
        );
    END IF;

    -- 2. Commission for Referrer (Indicador)
    IF NEW.referrer_id IS NOT NULL AND COALESCE(NEW.referrer_percent, 0) > 0 THEN
        INSERT INTO public.commissions (
            referrer_id, sale_id, client_id, product_id,
            amount, percent, sale_value,
            status, workflow_status, notes, commission_type
        )
        VALUES (
            NEW.referrer_id, NEW.id, NEW.client_id, NEW.product_id,
            ROUND((NEW.amount * NEW.referrer_percent) / 100, 2),
            NEW.referrer_percent, NEW.amount,
            'pendente', 'aguardando_confirmacao',
            'Comissão de Indicador gerada via venda ' || NEW.id,
            'percentual'
        );
    END IF;

    -- 3. Commission for Collaborator
    IF NEW.collaborator_id IS NOT NULL AND COALESCE(NEW.collaborator_percent, 0) > 0 THEN
        INSERT INTO public.commissions (
            collaborator_id, sale_id, client_id, product_id,
            amount, percent, sale_value,
            status, workflow_status, notes, commission_type
        )
        VALUES (
            NEW.collaborator_id, NEW.id, NEW.client_id, NEW.product_id,
            ROUND((NEW.amount * NEW.collaborator_percent) / 100, 2),
            NEW.collaborator_percent, NEW.amount,
            'pendente', 'aguardando_confirmacao',
            'Comissão de Colaborador gerada via venda ' || NEW.id,
            'percentual'
        );
    END IF;

    -- 4. Create initial payment
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

    -- 5. Audit Log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, metadata)
    VALUES ('CREATE_SALE', 'sales', NEW.id, NEW.created_by,
            jsonb_build_object('amount', NEW.amount, 'client_id', NEW.client_id));

    -- 6. Update client status
    UPDATE public.clients SET status = 'ativo'
    WHERE id = NEW.client_id AND status = 'prospecto';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
