
-- ============================================================
-- Sessão 2 — Correção de visibilidade e hardening de segurança
-- ============================================================

-- 1) REVERTER handle_new_sale para versão SEGURA
-- A versão anterior referenciava commissions.referrer_id e commissions.collaborator_id
-- que NÃO EXISTEM. Isso quebrava QUALQUER venda com indicador ou colaborador.
-- commission_splits (gerado por handle_sale_splits) já cobre os 3 beneficiários.
CREATE OR REPLACE FUNCTION public.handle_new_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Comissão do parceiro (tabela commissions usa apenas partner)
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

-- 2) sync_commission_split_status: rever para forma SEGURA (só partner existe em commissions)
CREATE OR REPLACE FUNCTION public.sync_commission_split_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.partner_id IS NOT NULL THEN
    UPDATE public.commission_splits
    SET status = NEW.status::text::split_status,
        paid_at = NEW.paid_at,
        updated_at = now()
    WHERE sale_id = NEW.sale_id
      AND beneficiary_type = 'partner'
      AND beneficiary_id = NEW.partner_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Remove função duplicada não utilizada (handle_sale_splits é o trigger ativo)
DROP FUNCTION IF EXISTS public.generate_commission_splits() CASCADE;

-- 4) Propagar collaborator_id/service_provider_id ao INSERT de cliente também
--    (quando criar cliente já com colaborador definido E houver demanda futura,
--    fill_client_product_responsible/provider já cobre via INSERT em client_products.
--    Mas se já existir demanda quando o cliente for atualizado, propagate cobre.)
--    Não precisa de novo trigger.

-- 5) HARDENING — revogar EXECUTE de anon em funções sensíveis SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_client_onboarding() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_action(text, text, uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_pending_commissions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_overdue_documents() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_payments() FROM anon;

-- 6) create_notification: exigir admin OU contexto de trigger (caller=postgres)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_title text, p_message text,
  p_type text DEFAULT 'info'::text, p_link text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_id UUID;
BEGIN
    -- Só admins ou contexto de trigger interno podem disparar notificações arbitrárias
    IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Permissão negada para criar notificações';
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (p_user_id, p_title, p_message, p_type, p_link)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$function$;
