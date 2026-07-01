
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS service_provider_id uuid REFERENCES public.service_providers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS commissions_service_provider_id_idx ON public.commissions(service_provider_id);

ALTER TABLE public.commissions DROP CONSTRAINT IF EXISTS commissions_beneficiary_check;
ALTER TABLE public.commissions ADD CONSTRAINT commissions_beneficiary_check
  CHECK (partner_id IS NOT NULL OR collaborator_id IS NOT NULL OR referrer_id IS NOT NULL OR service_provider_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.handle_sale_splits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_base numeric(12,2);
  v_partner_amount numeric(12,2);
  v_referrer_amount numeric(12,2);
  v_collab_amount numeric(12,2);
  v_provider_amount numeric(12,2);
BEGIN
  v_partner_base := GREATEST(COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0), 0);
  v_partner_amount  := (v_partner_base * COALESCE(NEW.commission_percent, 0)) / 100;
  v_referrer_amount := (NEW.amount * COALESCE(NEW.referrer_percent, 0)) / 100;
  v_collab_amount   := (NEW.amount * COALESCE(NEW.collaborator_percent, 0)) / 100;
  v_provider_amount := COALESCE(NEW.provider_cost, 0);

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
  IF NEW.service_provider_id IS NOT NULL AND v_provider_amount > 0 THEN
    INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
    VALUES (NEW.id, 'service_provider', NEW.service_provider_id, v_provider_amount, 0);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_sale()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_partner_base numeric(12,2);
BEGIN
  v_partner_base := GREATEST(COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0), 0);
  IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent, 0) > 0 THEN
    INSERT INTO public.commissions (partner_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.partner_id, NEW.id, NEW.client_id, NEW.product_id, ROUND((v_partner_base * NEW.commission_percent)/100,2), NEW.commission_percent, v_partner_base, 'pendente','aguardando_confirmacao','Comissão de Parceiro gerada via venda '||NEW.id,'percentual');
  END IF;
  IF NEW.referrer_id IS NOT NULL AND COALESCE(NEW.referrer_percent, 0) > 0 THEN
    INSERT INTO public.commissions (referrer_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.referrer_id, NEW.id, NEW.client_id, NEW.product_id, ROUND((NEW.amount * NEW.referrer_percent)/100,2), NEW.referrer_percent, NEW.amount, 'pendente','aguardando_confirmacao','Comissão de Indicador gerada via venda '||NEW.id,'percentual');
  END IF;
  IF NEW.collaborator_id IS NOT NULL AND COALESCE(NEW.collaborator_percent, 0) > 0 THEN
    INSERT INTO public.commissions (collaborator_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.collaborator_id, NEW.id, NEW.client_id, NEW.product_id, ROUND((NEW.amount * NEW.collaborator_percent)/100,2), NEW.collaborator_percent, NEW.amount, 'pendente','aguardando_confirmacao','Comissão de Colaborador gerada via venda '||NEW.id,'percentual');
  END IF;
  IF NEW.service_provider_id IS NOT NULL AND COALESCE(NEW.provider_cost, 0) > 0 THEN
    INSERT INTO public.commissions (service_provider_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
    VALUES (NEW.service_provider_id, NEW.id, NEW.client_id, NEW.product_id, ROUND(NEW.provider_cost,2), 0, NEW.amount, 'pendente','aguardando_confirmacao','Repasse ao Prestador gerado via venda '||NEW.id,'fixo');
  END IF;
  RETURN NEW;
END;
$function$;

INSERT INTO public.commission_splits (sale_id, beneficiary_type, beneficiary_id, amount, percent)
SELECT s.id, 'service_provider', s.service_provider_id, s.provider_cost, 0
FROM public.sales s
WHERE s.service_provider_id IS NOT NULL AND COALESCE(s.provider_cost,0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.commission_splits cs WHERE cs.sale_id=s.id AND cs.beneficiary_type='service_provider');

INSERT INTO public.commissions (service_provider_id, sale_id, client_id, product_id, amount, percent, sale_value, status, workflow_status, notes, commission_type)
SELECT s.service_provider_id, s.id, s.client_id, s.product_id, ROUND(s.provider_cost,2), 0, s.amount, 'pendente','aguardando_confirmacao','Repasse ao Prestador (backfill) venda '||s.id, 'fixo'
FROM public.sales s
WHERE s.service_provider_id IS NOT NULL AND COALESCE(s.provider_cost,0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.commissions c WHERE c.sale_id=s.id AND c.service_provider_id=s.service_provider_id);
