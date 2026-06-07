
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS zenon_cost numeric(12,2) NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.sales.zenon_cost IS 'Custo interno Zenon (lucro direto). Oculto ao parceiro. Comissão do parceiro = (amount - zenon_cost) * %.';

REVOKE SELECT ON public.sales FROM authenticated;
GRANT SELECT (id, client_id, product_id, partner_id, referrer_id, collaborator_id, amount, commission_percent, referrer_percent, collaborator_percent, status, sale_date, notes, created_at, updated_at, created_by, paid_at, payment_method, invoice_number)
  ON public.sales TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_base numeric(12,2);
BEGIN
  v_partner_base := GREATEST(COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0), 0);

  IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent, 0) > 0 THEN
    INSERT INTO public.commissions (
      partner_id, sale_id, client_id, product_id,
      amount, percent, sale_value,
      status, workflow_status, notes, commission_type
    ) VALUES (
      NEW.partner_id, NEW.id, NEW.client_id, NEW.product_id,
      ROUND((v_partner_base * NEW.commission_percent) / 100, 2),
      NEW.commission_percent, v_partner_base,
      'pendente', 'aguardando_confirmacao',
      'Comissão de Parceiro gerada via venda ' || NEW.id,
      'percentual'
    );
  END IF;

  IF NEW.referrer_id IS NOT NULL AND COALESCE(NEW.referrer_percent, 0) > 0 THEN
    INSERT INTO public.commissions (
      referrer_id, sale_id, client_id, product_id,
      amount, percent, sale_value,
      status, workflow_status, notes, commission_type
    ) VALUES (
      NEW.referrer_id, NEW.id, NEW.client_id, NEW.product_id,
      ROUND((NEW.amount * NEW.referrer_percent) / 100, 2),
      NEW.referrer_percent, NEW.amount,
      'pendente', 'aguardando_confirmacao',
      'Comissão de Indicador gerada via venda ' || NEW.id,
      'percentual'
    );
  END IF;

  IF NEW.collaborator_id IS NOT NULL AND COALESCE(NEW.collaborator_percent, 0) > 0 THEN
    INSERT INTO public.commissions (
      collaborator_id, sale_id, client_id, product_id,
      amount, percent, sale_value,
      status, workflow_status, notes, commission_type
    ) VALUES (
      NEW.collaborator_id, NEW.id, NEW.client_id, NEW.product_id,
      ROUND((NEW.amount * NEW.collaborator_percent) / 100, 2),
      NEW.collaborator_percent, NEW.amount,
      'pendente', 'aguardando_confirmacao',
      'Comissão de Colaborador gerada via venda ' || NEW.id,
      'percentual'
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_sale_splits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_base    numeric(12,2);
  v_partner_amount  numeric(12,2);
  v_referrer_amount numeric(12,2);
  v_collab_amount   numeric(12,2);
BEGIN
  v_partner_base    := GREATEST(COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0), 0);
  v_partner_amount  := (v_partner_base * COALESCE(NEW.commission_percent, 0)) / 100;
  v_referrer_amount := (NEW.amount     * COALESCE(NEW.referrer_percent, 0))   / 100;
  v_collab_amount   := (NEW.amount     * COALESCE(NEW.collaborator_percent, 0)) / 100;

  IF NEW.partner_id IS NOT NULL AND v_partner_amount > 0 THEN
    INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
    VALUES (NEW.id, 'partner', NEW.partner_id, v_partner_amount, NEW.commission_percent);
  END IF;

  IF NEW.referrer_id IS NOT NULL AND v_referrer_amount > 0 THEN
    INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
    VALUES (NEW.id, 'referrer', NEW.referrer_id, v_referrer_amount, NEW.referrer_percent);
  END IF;

  IF NEW.collaborator_id IS NOT NULL AND v_collab_amount > 0 THEN
    INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
    VALUES (NEW.id, 'collaborator', NEW.collaborator_id, v_collab_amount, NEW.collaborator_percent);
  END IF;

  RETURN NEW;
END;
$function$;
