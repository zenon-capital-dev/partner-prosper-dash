-- =====================================================================
-- Cascata de deduções e base de cálculo do parceiro
-- ---------------------------------------------------------------------
-- A receita do cliente não entra limpa. Antes da comissão do parceiro,
-- a Zenon provisiona as deduções da operação (imposto, jurídico,
-- sistema, prestador, PJ, taxas...). O que sobra é a base de cálculo.
--
-- Exemplo: bruto 1.000.000; imposto 15%, jurídico 2%, sistema 3%,
-- prestador 5%, PJ 1 15% (todas sobre o bruto) => base 600.000.
-- Parceiro 10% => comissão 60.000.
--
-- Compatibilidade: sales.zenon_cost e sales.provider_cost continuam
-- existindo e passam a ser TOTAIS calculados das deduções
-- (prestador => provider_cost; todo o resto => zenon_cost). Assim
-- Financeiro, Dashboard e Vendas seguem funcionando sem mudança.
--
-- Vendas que já existiam ficam no modelo "legado": a base do parceiro
-- continua bruto menos custo Zenon, exatamente como foram fechadas.
-- Vendas novas nascem no modelo "cascata".
-- Só o admin enxerga qualquer coisa desta migration.
-- =====================================================================

-- 1) Catálogo de deduções (o admin cadastra novos tipos sem precisar de dev)
CREATE TABLE IF NOT EXISTS public.deduction_types (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL UNIQUE,
  category             text NOT NULL CHECK (category IN
                         ('imposto','juridico','sistema','prestador','pj','taxa','custo_zenon','outros')),
  default_percent      numeric CHECK (default_percent IS NULL OR (default_percent >= 0 AND default_percent <= 100)),
  default_fixed_amount numeric CHECK (default_fixed_amount IS NULL OR default_fixed_amount >= 0),
  sort_order           integer NOT NULL DEFAULT 100,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.deduction_types (name, category, default_percent, sort_order) VALUES
  ('Imposto',              'imposto',   15, 10),
  ('Jurídico',             'juridico',   2, 20),
  ('Sistema',              'sistema',    3, 30),
  ('Prestador de serviço', 'prestador',  5, 40),
  ('PJ 1',                 'pj',        15, 50)
ON CONFLICT (name) DO NOTHING;
INSERT INTO public.deduction_types (name, category, default_percent, sort_order) VALUES
  ('Custo Zenon',          'custo_zenon', NULL, 90)
ON CONFLICT (name) DO NOTHING;

-- 2) Deduções padrão por produto
CREATE TABLE IF NOT EXISTS public.product_deduction_templates (
  product_id        uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  deduction_type_id uuid NOT NULL REFERENCES public.deduction_types(id) ON DELETE CASCADE,
  percent           numeric CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100)),
  fixed_amount      numeric CHECK (fixed_amount IS NULL OR fixed_amount >= 0),
  PRIMARY KEY (product_id, deduction_type_id),
  CHECK (percent IS NOT NULL OR fixed_amount IS NOT NULL)
);

-- 3) Deduções de cada venda
CREATE TABLE IF NOT EXISTS public.sale_deductions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  deduction_type_id uuid NOT NULL REFERENCES public.deduction_types(id) ON DELETE RESTRICT,
  percent           numeric CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100)),
  fixed_amount      numeric CHECK (fixed_amount IS NULL OR fixed_amount >= 0),
  payee_id          uuid,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sale_id, deduction_type_id),
  CHECK (percent IS NOT NULL OR fixed_amount IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sale_deductions_sale_id_idx ON public.sale_deductions(sale_id);

-- 4) RLS: somente admin, nas três tabelas
ALTER TABLE public.deduction_types             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_deduction_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_deductions             ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deduction_types, public.product_deduction_templates, public.sale_deductions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.deduction_types, public.product_deduction_templates, public.sale_deductions TO authenticated;

DROP POLICY IF EXISTS "Somente admin: tipos de dedução" ON public.deduction_types;
CREATE POLICY "Somente admin: tipos de dedução" ON public.deduction_types
  FOR ALL TO authenticated
  USING (private.is_admin((SELECT auth.uid()))) WITH CHECK (private.is_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "Somente admin: deduções por produto" ON public.product_deduction_templates;
CREATE POLICY "Somente admin: deduções por produto" ON public.product_deduction_templates
  FOR ALL TO authenticated
  USING (private.is_admin((SELECT auth.uid()))) WITH CHECK (private.is_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS "Somente admin: deduções da venda" ON public.sale_deductions;
CREATE POLICY "Somente admin: deduções da venda" ON public.sale_deductions
  FOR ALL TO authenticated
  USING (private.is_admin((SELECT auth.uid()))) WITH CHECK (private.is_admin((SELECT auth.uid())));

-- 5) Modelo de cálculo da venda. Coluna criada com 'legado' (preenche as
--    vendas existentes sem disparar gatilho) e depois o padrão vira 'cascata'.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS deduction_model text NOT NULL DEFAULT 'legado';
ALTER TABLE public.sales ALTER COLUMN deduction_model SET DEFAULT 'cascata';
DO $$ BEGIN
  ALTER TABLE public.sales ADD CONSTRAINT sales_deduction_model_check CHECK (deduction_model IN ('legado','cascata'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6) Vendas existentes: custos atuais viram linhas de dedução (valor fixo),
--    só para aparecerem na cascata. Nenhum valor muda.
INSERT INTO public.sale_deductions (sale_id, deduction_type_id, fixed_amount, notes)
SELECT s.id, t.id, s.zenon_cost, 'Migrado do campo Custo Zenon'
  FROM public.sales s
  JOIN public.deduction_types t ON t.name = 'Custo Zenon'
 WHERE COALESCE(s.zenon_cost, 0) > 0
ON CONFLICT (sale_id, deduction_type_id) DO NOTHING;

INSERT INTO public.sale_deductions (sale_id, deduction_type_id, fixed_amount, payee_id, notes)
SELECT s.id, t.id, s.provider_cost, s.service_provider_id, 'Migrado do campo Repasse ao Prestador'
  FROM public.sales s
  JOIN public.deduction_types t ON t.name = 'Prestador de serviço'
 WHERE COALESCE(s.provider_cost, 0) > 0
ON CONFLICT (sale_id, deduction_type_id) DO NOTHING;

-- 7) Totais da cascata: prestador vai para provider_cost, o resto para zenon_cost
CREATE OR REPLACE FUNCTION private.sale_deduction_totals(p_sale_id uuid, p_amount numeric)
RETURNS TABLE (costs_zenon numeric, costs_provider numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(v.amt) FILTER (WHERE v.category <> 'prestador'), 0),
    COALESCE(SUM(v.amt) FILTER (WHERE v.category =  'prestador'), 0)
  FROM (
    SELECT t.category,
           COALESCE(d.fixed_amount, round(COALESCE(p_amount, 0) * d.percent / 100, 2)) AS amt
      FROM public.sale_deductions d
      JOIN public.deduction_types t ON t.id = d.deduction_type_id
     WHERE d.sale_id = p_sale_id
  ) v;
$$;
REVOKE ALL ON FUNCTION private.sale_deduction_totals(uuid, numeric) FROM PUBLIC, anon, authenticated;

-- 8) Ao gravar a venda (inclusive mudança de valor), os custos são
--    recalculados a partir das deduções, quando a venda tem deduções.
CREATE OR REPLACE FUNCTION private.sales_apply_deductions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_z numeric;
  v_p numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.sale_deductions WHERE sale_id = NEW.id) THEN
    SELECT costs_zenon, costs_provider INTO v_z, v_p
      FROM private.sale_deduction_totals(NEW.id, NEW.amount);
    NEW.zenon_cost := v_z;
    NEW.provider_cost := v_p;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sales_apply_deductions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sales_apply_deductions ON public.sales;
CREATE TRIGGER trg_sales_apply_deductions
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION private.sales_apply_deductions();

-- 9) Ao mexer nas deduções, atualiza os custos da venda (o que dispara o
--    recálculo de comissões e repasses que já existe). Um UPDATE por venda.
CREATE OR REPLACE FUNCTION private.sale_deductions_sync_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sales s
     SET zenon_cost = t.costs_zenon,
         provider_cost = t.costs_provider
    FROM (SELECT DISTINCT sale_id FROM changed_rows) c,
         LATERAL private.sale_deduction_totals(c.sale_id, (SELECT amount FROM public.sales WHERE id = c.sale_id)) t
   WHERE s.id = c.sale_id
     AND (s.zenon_cost IS DISTINCT FROM t.costs_zenon OR s.provider_cost IS DISTINCT FROM t.costs_provider);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.sale_deductions_sync_sale() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sale_deductions_sync_ins ON public.sale_deductions;
CREATE TRIGGER trg_sale_deductions_sync_ins
  AFTER INSERT ON public.sale_deductions
  REFERENCING NEW TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION private.sale_deductions_sync_sale();
DROP TRIGGER IF EXISTS trg_sale_deductions_sync_upd ON public.sale_deductions;
CREATE TRIGGER trg_sale_deductions_sync_upd
  AFTER UPDATE ON public.sale_deductions
  REFERENCING NEW TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION private.sale_deductions_sync_sale();
DROP TRIGGER IF EXISTS trg_sale_deductions_sync_del ON public.sale_deductions;
CREATE TRIGGER trg_sale_deductions_sync_del
  AFTER DELETE ON public.sale_deductions
  REFERENCING OLD TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION private.sale_deductions_sync_sale();

-- 10) Comissões e repasses usam a base de cálculo da cascata
CREATE OR REPLACE FUNCTION public.handle_sale_splits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_base numeric(12,2);
  v_partner_amount numeric(12,2);
  v_referrer_amount numeric(12,2);
  v_collab_amount numeric(12,2);
  v_provider_amount numeric(12,2);
BEGIN
  -- Só venda finalizada entra na esteira financeira de repasses.
  IF NEW.status::text <> 'concluida' THEN
    UPDATE public.commission_splits
       SET status = 'cancelado'::split_status,
           paid_at = NULL,
           updated_at = now()
     WHERE sale_id = NEW.id
       AND status::text <> 'pago';
    RETURN NEW;
  END IF;

  -- Recalcula apenas o que ainda não foi pago, preservando histórico quitado.
  DELETE FROM public.commission_splits
   WHERE sale_id = NEW.id
     AND status::text <> 'pago';

  -- Base do parceiro:
  --   cascata: bruto menos TODAS as deduções (custos Zenon + prestador)
  --   legado : regra antiga, bruto menos custo Zenon (vendas anteriores à cascata)
  v_partner_base := GREATEST(
    COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0)
    - CASE WHEN NEW.deduction_model = 'cascata' THEN COALESCE(NEW.provider_cost,0) ELSE 0 END,
    0);
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
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_partner_base numeric(12,2);
BEGIN
  -- Negociação/proposta não gera pendência financeira de comissão.
  IF NEW.status::text <> 'concluida' THEN
    UPDATE public.commissions
       SET status = 'cancelado',
           workflow_status = 'cancelada',
           paid_at = NULL,
           payment_date = NULL,
           approval_date = NULL,
           updated_at = now()
     WHERE sale_id = NEW.id
       AND COALESCE(status::text, '') NOT IN ('pago','paga');
    RETURN NEW;
  END IF;

  -- Evita duplicidade quando a venda é editada depois de finalizada.
  DELETE FROM public.commissions
   WHERE sale_id = NEW.id
     AND COALESCE(status::text, '') NOT IN ('pago','paga');

  -- Base do parceiro:
  --   cascata: bruto menos TODAS as deduções (custos Zenon + prestador)
  --   legado : regra antiga, bruto menos custo Zenon (vendas anteriores à cascata)
  v_partner_base := GREATEST(
    COALESCE(NEW.amount,0) - COALESCE(NEW.zenon_cost,0)
    - CASE WHEN NEW.deduction_model = 'cascata' THEN COALESCE(NEW.provider_cost,0) ELSE 0 END,
    0);

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