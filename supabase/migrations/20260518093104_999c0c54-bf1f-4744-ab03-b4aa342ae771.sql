-- Função para gerar comissões e pagamentos ao inserir uma venda
CREATE OR REPLACE FUNCTION public.handle_new_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_liquido DECIMAL;
    v_total_commissions DECIMAL := 0;
    v_partner_amt DECIMAL := 0;
    v_referrer_amt DECIMAL := 0;
    v_collaborator_amt DECIMAL := 0;
BEGIN
    -- 1. Calcular valores de comissão
    IF NEW.partner_id IS NOT NULL AND NEW.commission_percent > 0 THEN
        v_partner_amt := (NEW.amount * NEW.commission_percent) / 100;
        v_total_commissions := v_total_commissions + v_partner_amt;
        
        INSERT INTO public.commissions (partner_id, sale_id, amount, status, notes)
        VALUES (NEW.partner_id, NEW.id, v_partner_amt, 'pendente', 'Gerada automaticamente via venda ' || NEW.id);
    END IF;

    IF NEW.referrer_id IS NOT NULL AND NEW.referrer_percent > 0 THEN
        v_referrer_amt := (NEW.amount * NEW.referrer_percent) / 100;
        v_total_commissions := v_total_commissions + v_referrer_amt;
        
        INSERT INTO public.commissions (referrer_id, sale_id, amount, status, notes)
        VALUES (NEW.referrer_id, NEW.id, v_referrer_amt, 'pendente', 'Gerada automaticamente via indicação na venda ' || NEW.id);
    END IF;

    IF NEW.collaborator_id IS NOT NULL AND NEW.collaborator_percent > 0 THEN
        v_collaborator_amt := (NEW.amount * NEW.collaborator_percent) / 100;
        v_total_commissions := v_total_commissions + v_collaborator_amt;
        
        -- Nota: Commissions table uses partner_id or referrer_id. 
        -- Se não tiver campo collaborator_id em commissions, ignoramos por enquanto ou usamos notes.
        -- Vou checar se existe campo collaborator_id em commissions.
    END IF;

    -- 2. Gerar Pagamento (Fatura) inicial para o cliente
    INSERT INTO public.payments (client_id, sale_id, amount, status, due_date, description)
    VALUES (NEW.client_id, NEW.id, NEW.amount, 'pendente', CURRENT_DATE + INTERVAL '3 days', 'Fatura gerada via venda: ' || NEW.id);

    -- 3. Log de Auditoria
    INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, metadata)
    VALUES ('CREATE_SALE', 'sales', NEW.id, NEW.created_by, jsonb_build_object('amount', NEW.amount, 'client_id', NEW.client_id));

    -- 4. Atualizar status do cliente se for a primeira venda
    UPDATE public.clients SET status = 'ativo' WHERE id = NEW.client_id AND status = 'prospecto';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para novas vendas
DROP TRIGGER IF EXISTS on_sale_created ON public.sales;
CREATE TRIGGER on_sale_created
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_new_sale();

-- Função para auditoria de pagamentos
CREATE OR REPLACE FUNCTION public.handle_payment_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO public.audit_logs (action, entity_type, entity_id, metadata)
        VALUES ('UPDATE_PAYMENT_STATUS', 'payments', NEW.id, jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para pagamentos
DROP TRIGGER IF EXISTS on_payment_updated ON public.payments;
CREATE TRIGGER on_payment_updated
AFTER UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.handle_payment_update();
