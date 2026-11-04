-- =====================================================================
-- Cofre de valores das demandas e contratos (complemento do sigilo)
-- ---------------------------------------------------------------------
-- Parceiro, indicador, prestador e colaborador precisam enxergar as
-- demandas (client_products), mas não o valor delas. Como o RLS não
-- esconde coluna, os valores saem de client_products e passam a morar
-- em client_product_financials, que só o admin lê.
--
-- Para não quebrar nenhuma tela que GRAVA valor, um gatilho desvia
-- automaticamente value, custom_value, discount, partner_commission e
-- employee_commission para o cofre e deixa as colunas de
-- client_products sempre vazias. As telas do admin leem o cofre.
-- =====================================================================

-- 1) Cofre
CREATE TABLE IF NOT EXISTS public.client_product_financials (
  client_product_id   uuid PRIMARY KEY
                      REFERENCES public.client_products(id) ON DELETE CASCADE
                      DEFERRABLE INITIALLY DEFERRED,
  value               numeric,
  custom_value        numeric,
  discount            numeric,
  partner_commission  numeric,
  employee_commission numeric,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_product_financials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_product_financials FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_product_financials TO authenticated;

DROP POLICY IF EXISTS "Somente admin acessa valores das demandas" ON public.client_product_financials;
CREATE POLICY "Somente admin acessa valores das demandas"
  ON public.client_product_financials
  FOR ALL TO authenticated
  USING (private.is_admin((SELECT auth.uid())))
  WITH CHECK (private.is_admin((SELECT auth.uid())));

-- 2) Move os valores existentes para o cofre e limpa client_products.
--    Gatilhos desligados só durante a cópia para não mexer em updated_at,
--    não gerar notificações nem log de atividade em massa.
INSERT INTO public.client_product_financials
  (client_product_id, value, custom_value, discount, partner_commission, employee_commission)
SELECT id, value, custom_value, discount, partner_commission, employee_commission
  FROM public.client_products
 WHERE value IS NOT NULL OR custom_value IS NOT NULL OR discount IS NOT NULL
    OR partner_commission IS NOT NULL OR employee_commission IS NOT NULL
ON CONFLICT (client_product_id) DO UPDATE SET
  value               = COALESCE(EXCLUDED.value, client_product_financials.value),
  custom_value        = COALESCE(EXCLUDED.custom_value, client_product_financials.custom_value),
  discount            = COALESCE(EXCLUDED.discount, client_product_financials.discount),
  partner_commission  = COALESCE(EXCLUDED.partner_commission, client_product_financials.partner_commission),
  employee_commission = COALESCE(EXCLUDED.employee_commission, client_product_financials.employee_commission),
  updated_at          = now();

ALTER TABLE public.client_products DISABLE TRIGGER USER;
UPDATE public.client_products
   SET value = NULL, custom_value = NULL, discount = NULL,
       partner_commission = NULL, employee_commission = NULL
 WHERE value IS NOT NULL OR custom_value IS NOT NULL OR discount IS NOT NULL
    OR partner_commission IS NOT NULL OR employee_commission IS NOT NULL;
ALTER TABLE public.client_products ENABLE TRIGGER USER;

-- 3) Gatilho que desvia qualquer gravação de valor para o cofre.
--    Nome começa com "zz" para rodar por último entre os BEFORE, depois
--    dos gatilhos que preenchem valor a partir do produto.
--    Observação: como as colunas ficam sempre vazias, gravar NULL não
--    apaga o valor do cofre. Para zerar, gravar 0.
CREATE OR REPLACE FUNCTION private.divert_client_product_money()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.value IS NOT NULL OR NEW.custom_value IS NOT NULL OR NEW.discount IS NOT NULL
     OR NEW.partner_commission IS NOT NULL OR NEW.employee_commission IS NOT NULL THEN
    INSERT INTO public.client_product_financials AS f
      (client_product_id, value, custom_value, discount, partner_commission, employee_commission)
    VALUES
      (NEW.id, NEW.value, NEW.custom_value, NEW.discount, NEW.partner_commission, NEW.employee_commission)
    ON CONFLICT (client_product_id) DO UPDATE SET
      value               = COALESCE(EXCLUDED.value, f.value),
      custom_value        = COALESCE(EXCLUDED.custom_value, f.custom_value),
      discount            = COALESCE(EXCLUDED.discount, f.discount),
      partner_commission  = COALESCE(EXCLUDED.partner_commission, f.partner_commission),
      employee_commission = COALESCE(EXCLUDED.employee_commission, f.employee_commission),
      updated_at          = now();

    NEW.value := NULL;
    NEW.custom_value := NULL;
    NEW.discount := NULL;
    NEW.partner_commission := NULL;
    NEW.employee_commission := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.divert_client_product_money() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_divert_client_product_money ON public.client_products;
CREATE TRIGGER zz_divert_client_product_money
  BEFORE INSERT OR UPDATE ON public.client_products
  FOR EACH ROW EXECUTE FUNCTION private.divert_client_product_money();

-- 4) Funções do banco que liam os valores direto de client_products
CREATE OR REPLACE FUNCTION public.sync_splits_for_payment(p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  v_client_partner uuid;
  v_client_referrer uuid;
  v_client_collab uuid;
  v_partner_pct numeric := 0;
  v_collab_pct numeric := 0;
  v_ref_pct numeric := 0;
  v_partner_id uuid;
  v_referrer_id uuid;
  v_collab_id uuid;
  base numeric;
  amt numeric;
  new_status split_status;
  pay_at timestamptz;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- If linked to a sale, the sale-based flow (handle_sale_splits + maybe_release_commission) owns it.
  IF p.sale_id IS NOT NULL THEN RETURN; END IF;

  SELECT partner_id, referrer_id, collaborator_id
    INTO v_client_partner, v_client_referrer, v_client_collab
    FROM public.clients WHERE id = p.client_id;

  IF p.client_product_id IS NOT NULL THEN
    SELECT COALESCE(partner_commission,0), COALESCE(employee_commission,0)
      INTO v_partner_pct, v_collab_pct
      FROM public.client_product_financials WHERE client_product_id = p.client_product_id;
  END IF;

  v_partner_id  := COALESCE(p.partner_id,  v_client_partner);
  v_referrer_id := COALESCE(p.referrer_id, v_client_referrer);
  v_collab_id   := COALESCE(p.collaborator_id, v_client_collab);

  IF v_referrer_id IS NOT NULL THEN
    SELECT COALESCE(commission_percent, 0) INTO v_ref_pct
      FROM public.referrers WHERE id = v_referrer_id;
  END IF;

  base := COALESCE(p.amount, 0);
  IF base <= 0 THEN RETURN; END IF;

  IF p.status::text IN ('cancelado','cancelada','estornado','reembolsado') THEN
    UPDATE public.commission_splits
       SET status = 'cancelado'::split_status, updated_at = now()
     WHERE payment_id = p_payment_id AND status::text <> 'pago';
    RETURN;
  END IF;

  DELETE FROM public.commission_splits
   WHERE payment_id = p_payment_id AND status::text <> 'pago';

  IF p.status::text IN ('pago','paga') THEN
    new_status := 'pago'::split_status;
    pay_at := COALESCE(p.paid_at, now());
  ELSE
    new_status := 'pendente'::split_status;
    pay_at := NULL;
  END IF;

  IF v_partner_id IS NOT NULL AND v_partner_pct > 0 THEN
    amt := round(base * (v_partner_pct / 100.0), 2);
    IF amt > 0 THEN
      INSERT INTO public.commission_splits
        (sale_id, payment_id, client_id, client_product_id, beneficiary_type, beneficiary_id, amount, percent, status, paid_at)
      VALUES (NULL, p_payment_id, p.client_id, p.client_product_id, 'partner', v_partner_id, amt, v_partner_pct, new_status, pay_at);
    END IF;
  END IF;

  IF v_referrer_id IS NOT NULL AND v_ref_pct > 0 THEN
    amt := round(base * (v_ref_pct / 100.0), 2);
    IF amt > 0 THEN
      INSERT INTO public.commission_splits
        (sale_id, payment_id, client_id, client_product_id, beneficiary_type, beneficiary_id, amount, percent, status, paid_at)
      VALUES (NULL, p_payment_id, p.client_id, p.client_product_id, 'referrer', v_referrer_id, amt, v_ref_pct, new_status, pay_at);
    END IF;
  END IF;

  IF v_collab_id IS NOT NULL AND v_collab_pct > 0 THEN
    amt := round(base * (v_collab_pct / 100.0), 2);
    IF amt > 0 THEN
      INSERT INTO public.commission_splits
        (sale_id, payment_id, client_id, client_product_id, beneficiary_type, beneficiary_id, amount, percent, status, paid_at)
      VALUES (NULL, p_payment_id, p.client_id, p.client_product_id, 'collaborator', v_collab_id, amt, v_collab_pct, new_status, pay_at);
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_sale_to_client_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_target_status text;
  v_client record;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT collaborator_id, responsible_id, service_provider_id, provider_id
  INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  v_target_status := CASE
    WHEN NEW.status::text = 'cancelada' THEN 'cancelado'
    WHEN NEW.status::text = 'concluida' THEN 'em_andamento'
    ELSE NEW.status::text
  END;

  SELECT id INTO v_existing_id
  FROM public.client_products
  WHERE sale_id = NEW.id
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    SELECT cp.id INTO v_existing_id
    FROM public.client_products cp
    WHERE cp.client_id = NEW.client_id
      AND cp.product_id = NEW.product_id
      AND cp.sale_id IS NULL
      AND cp.created_at >= now() - interval '15 minutes'
    ORDER BY cp.created_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.client_products
    SET sale_id = COALESCE(sale_id, NEW.id),
        status = CASE WHEN TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN v_target_status ELSE status END,
        -- o valor fica no cofre (client_product_financials): só preenche se ainda não houver
        value = CASE WHEN EXISTS (SELECT 1 FROM public.client_product_financials f
                                   WHERE f.client_product_id = v_existing_id AND f.value IS NOT NULL)
                     THEN NULL ELSE NEW.amount END,
        responsible_employee_id = COALESCE(responsible_employee_id, NEW.collaborator_id, v_client.collaborator_id, v_client.responsible_id),
        service_provider_id = COALESCE(service_provider_id, v_client.service_provider_id, v_client.provider_id),
        updated_at = now()
    WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  IF NEW.status::text = 'cancelada' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.client_products (
    client_id, product_id, sale_id, status, value, start_date,
    responsible_employee_id, service_provider_id
  )
  VALUES (
    NEW.client_id, NEW.product_id, NEW.id, v_target_status,
    NEW.amount, COALESCE(NEW.sale_date, CURRENT_DATE),
    COALESCE(NEW.collaborator_id, v_client.collaborator_id, v_client.responsible_id),
    COALESCE(v_client.service_provider_id, v_client.provider_id)
  );

  RETURN NEW;
END;
$function$;

-- 5) Resumo financeiro por cliente lendo o valor do cofre
CREATE OR REPLACE VIEW public.view_client_financial_summary
WITH (security_invoker = true) AS
SELECT c.id AS client_id,
    c.full_name,
    COALESCE(sum(DISTINCT cpf.value), (0)::numeric) AS total_contracted,
    COALESCE(sum(
        CASE
            WHEN (p.status = 'pago'::payment_status) THEN p.amount_paid
            ELSE (0)::numeric
        END), (0)::numeric) AS total_paid,
    COALESCE(sum(
        CASE
            WHEN (p.status = ANY (ARRAY['pendente'::payment_status, 'em_aberto'::payment_status, 'parcial'::payment_status])) THEN (p.amount - COALESCE(p.amount_paid, (0)::numeric))
            ELSE (0)::numeric
        END), (0)::numeric) AS total_pending,
    COALESCE(sum(
        CASE
            WHEN (p.status = 'vencido'::payment_status) THEN (p.amount - COALESCE(p.amount_paid, (0)::numeric))
            ELSE (0)::numeric
        END), (0)::numeric) AS total_overdue,
    count(DISTINCT
        CASE
            WHEN (cp.status <> ALL (ARRAY['cancelado'::text, 'finalizado'::text])) THEN cp.id
            ELSE NULL::uuid
        END) AS active_products
   FROM clients c
     LEFT JOIN client_products cp ON cp.client_id = c.id
     LEFT JOIN client_product_financials cpf ON cpf.client_product_id = cp.id
     LEFT JOIN payments p ON p.client_id = c.id
  GROUP BY c.id, c.full_name;

-- 6) Contratos de clientes: parceiro, indicador e prestador não leem mais
--    a tabela (ela traz o valor do contrato). Nenhuma tela desses papéis
--    consulta contracts direto; o dossiê do prestador usa função própria
--    que já não devolve valor. Cliente e colaborador continuam como estão.
DROP POLICY IF EXISTS "Partners can view their own contracts"           ON public.contracts;
DROP POLICY IF EXISTS "Provider views delegated contracts"              ON public.contracts;
DROP POLICY IF EXISTS "Referrers view related contracts"                ON public.contracts;
DROP POLICY IF EXISTS "Service providers can view their own contracts"  ON public.contracts;