-- =====================================================================
-- Fluxo de caixa: livro único de recebimentos e pagamentos
-- ---------------------------------------------------------------------
-- Depende das migrations 20261103200000 a 20261103260000.
--
-- Conceitos:
--   Obrigação  = o que já existe: payments (a receber), expenses e
--                commission_splits (a pagar), cash_other_income (a receber).
--   Liquidação = linha em cash_settlements: dinheiro que entrou ou saiu.
--   Estorno    = outra linha, ligada à original. Nada é apagado nem alterado.
--
-- Os campos antigos (payments.amount_paid, expenses.paid, status dos repasses)
-- continuam existindo porque dezenas de telas e gatilhos os leem. Eles passam a
-- ser espelho do livro. Se alguma tela gravar direto neles, um gatilho registra
-- a diferença no livro, então nenhum caminho fica de fora.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_accounts_one_default ON public.cash_accounts (is_default) WHERE is_default;
INSERT INTO public.cash_accounts (name, is_default) VALUES ('Conta principal', true) ON CONFLICT (name) DO NOTHING;

-- Quem vê o caixa consolidado além de admin e super admin. Admin secundário só entra aqui.
CREATE TABLE IF NOT EXISTS public.cash_permissions (
  user_id uuid PRIMARY KEY,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Saldo real em uma data. Vale sempre a linha mais recente de cada conta.
CREATE TABLE IF NOT EXISTS public.cash_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.cash_accounts(id),
  reference_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Entrada que não vem de venda (aporte, reembolso recebido, outras receitas).
CREATE TABLE IF NOT EXISTS public.cash_other_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL CHECK (length(trim(description)) > 0),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  nature text NOT NULL DEFAULT 'outras_receitas'
    CHECK (nature IN ('outras_receitas','aporte','reembolso_recebido','transferencia_externa')),
  counterparty text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  notes text,
  receipt_url text,
  canceled_at timestamptz,
  canceled_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cash_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('entrada','saida')),
  source_type text NOT NULL CHECK (source_type IN ('payment','expense','commission_split','other_income')),
  source_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'liquidacao' CHECK (kind IN ('liquidacao','estorno','devolucao')),
  reverses_id uuid REFERENCES public.cash_settlements(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  effective_date date NOT NULL,
  account_id uuid NOT NULL REFERENCES public.cash_accounts(id),
  payment_method text,
  notes text,
  reason text,
  origin text NOT NULL DEFAULT 'acao' CHECK (origin IN ('acao','captura','historico')),
  verified boolean NOT NULL DEFAULT true,
  idempotency_key text UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'liquidacao') = (reverses_id IS NULL)),
  CHECK (kind = 'liquidacao' OR length(trim(COALESCE(reason, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS cash_settlements_source_idx ON public.cash_settlements (source_type, source_id);
CREATE INDEX IF NOT EXISTS cash_settlements_date_idx ON public.cash_settlements (effective_date);
CREATE UNIQUE INDEX IF NOT EXISTS cash_settlements_historic_once
  ON public.cash_settlements (source_type, source_id) WHERE origin = 'historico';

-- ---------------------------------------------------------------------
-- 2) Permissão: validada no banco
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_access_cash(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  ) OR EXISTS (SELECT 1 FROM public.cash_permissions WHERE user_id = _user_id)
$$;
REVOKE ALL ON FUNCTION private.can_access_cash(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_cash(uuid) TO authenticated;

-- Operar uma baixa continua liberado a quem já fazia isso nas telas (admin secundário).
-- Ver o caixa consolidado exige can_access_cash.
CREATE OR REPLACE FUNCTION private.can_operate_cash(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.can_access_cash(_user_id) OR private.is_admin(_user_id)
$$;
REVOKE ALL ON FUNCTION private.can_operate_cash(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_operate_cash(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cash_can_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT private.can_access_cash(auth.uid()) $$;
REVOKE ALL ON FUNCTION public.cash_can_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_can_access() TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cash_accounts','cash_permissions','cash_opening_balances','cash_other_income','cash_settlements'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS "Cash viewers read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Cash viewers read" ON public.%I FOR SELECT TO authenticated USING (private.can_access_cash(auth.uid()))', t);
  END LOOP;
END $$;

-- O livro não aceita alteração nem exclusão, nem para funções do sistema.
CREATE OR REPLACE FUNCTION private.cash_settlements_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.verified IS DISTINCT FROM OLD.verified
     AND (to_jsonb(NEW) - 'verified') = (to_jsonb(OLD) - 'verified') THEN
    RETURN NEW; -- confirmar um pagamento histórico é a única alteração possível
  END IF;
  RAISE EXCEPTION 'O livro de caixa não aceita alteração nem exclusão. Use o estorno.';
END;
$$;
DROP TRIGGER IF EXISTS trg_cash_settlements_append_only ON public.cash_settlements;

-- ---------------------------------------------------------------------
-- 3) Funções internas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.cash_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

CREATE OR REPLACE FUNCTION private.cash_default_account()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT id FROM public.cash_accounts WHERE is_default LIMIT 1 $$;

-- Quanto já foi liquidado, descontando estornos e devoluções.
CREATE OR REPLACE FUNCTION private.cash_net_settled(p_type text, p_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE WHEN kind = 'liquidacao' THEN amount ELSE -amount END), 0)
    FROM public.cash_settlements
   WHERE source_type = p_type AND source_id = p_id
$$;

-- Atualiza os campos antigos para refletir o livro. Roda com a marca
-- app.cash_ledger ligada, para o gatilho de captura não registrar de novo.
CREATE OR REPLACE FUNCTION private.cash_mirror_source(p_type text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric := private.cash_net_settled(p_type, p_id);
  v_last date;
  v_paid_at timestamptz;
  v_split record;
  v_col text;
BEGIN
  PERFORM set_config('app.cash_ledger', 'on', true);

  SELECT MAX(effective_date) INTO v_last
    FROM public.cash_settlements
   WHERE source_type = p_type AND source_id = p_id AND kind = 'liquidacao';
  -- Meio-dia em Brasília: a data não muda de dia em nenhum fuso usado pelo sistema.
  v_paid_at := CASE WHEN v_net > 0 AND v_last IS NOT NULL
                    THEN (v_last::timestamp + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo' END;

  IF p_type = 'payment' THEN
    UPDATE public.payments p
       SET amount_paid = v_net,
           paid_at = v_paid_at,
           status = CASE
                      WHEN p.status::text IN ('cancelado','cancelada','reembolsado','estornado') THEN p.status
                      WHEN v_net >= p.amount THEN 'pago'::payment_status
                      WHEN v_net > 0 THEN 'parcialmente_pago'::payment_status
                      ELSE 'pendente'::payment_status
                    END
     WHERE p.id = p_id;

  ELSIF p_type = 'expense' THEN
    UPDATE public.expenses e
       SET paid = (v_net >= e.amount),
           paid_at = CASE WHEN v_net >= e.amount THEN v_last END
     WHERE e.id = p_id;

  ELSIF p_type = 'commission_split' THEN
    UPDATE public.commission_splits s
       SET status = CASE
                      WHEN s.status::text = 'cancelado' THEN s.status
                      WHEN v_net >= s.amount THEN 'pago'::split_status
                      ELSE 'pendente'::split_status
                    END,
           paid_at = CASE WHEN v_net >= s.amount THEN v_paid_at END,
           updated_at = now()
     WHERE s.id = p_id
     RETURNING s.* INTO v_split;

    IF v_split.sale_id IS NOT NULL THEN
      v_col := CASE v_split.beneficiary_type::text
                 WHEN 'partner' THEN 'partner_id'
                 WHEN 'referrer' THEN 'referrer_id'
                 WHEN 'collaborator' THEN 'collaborator_id'
                 WHEN 'service_provider' THEN 'service_provider_id'
               END;
      IF v_col IS NOT NULL THEN
        EXECUTE format(
          'UPDATE public.commissions
              SET status = $1, paid_at = $2, payment_date = $2, updated_at = now()
            WHERE sale_id = $3 AND %I = $4 AND payment_id IS NULL
              AND COALESCE(status::text, '''') NOT IN (''cancelado'',''cancelada'')', v_col)
        USING CASE WHEN v_split.status::text = 'pago' THEN 'pago' ELSE 'pendente' END,
              v_split.paid_at, v_split.sale_id, v_split.beneficiary_id;
      END IF;
    END IF;
  END IF;

  PERFORM set_config('app.cash_ledger', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION private.cash_mirror_source(text, uuid) FROM PUBLIC, anon, authenticated;

-- Estorna um valor, da liquidação mais recente para a mais antiga.
CREATE OR REPLACE FUNCTION private.cash_reverse_amount(
  p_type text, p_id uuid, p_amount numeric, p_kind text, p_reason text, p_date date, p_origin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left numeric := p_amount;
  r record;
  v_take numeric;
BEGIN
  FOR r IN
    SELECT s.*, s.amount - COALESCE((SELECT SUM(x.amount) FROM public.cash_settlements x WHERE x.reverses_id = s.id), 0) AS open_amount
      FROM public.cash_settlements s
     WHERE s.source_type = p_type AND s.source_id = p_id AND s.kind = 'liquidacao'
     ORDER BY s.effective_date DESC, s.created_at DESC
  LOOP
    EXIT WHEN v_left <= 0;
    CONTINUE WHEN r.open_amount <= 0;
    v_take := LEAST(v_left, r.open_amount);
    INSERT INTO public.cash_settlements
      (direction, source_type, source_id, kind, reverses_id, amount, effective_date, account_id, reason, origin, verified, created_by)
    VALUES (r.direction, p_type, p_id, p_kind, r.id, v_take, p_date, r.account_id, p_reason, p_origin, r.verified, auth.uid());
    v_left := v_left - v_take;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.cash_reverse_amount(text, uuid, numeric, text, text, date, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Comissão: receber do cliente libera, mas não marca como paga
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.recompute_sale_release(p_sale_id uuid, p_reverted boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  v_received numeric;
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;
  SELECT id, amount, status::text AS status INTO s FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_received := CASE WHEN s.status = 'concluida' AND COALESCE(s.amount, 0) > 0 THEN private.sale_received(s.id) ELSE 0 END;

  UPDATE public.commission_splits cs
     SET released_amount = x.rel, updated_at = now()
    FROM (
      SELECT c.id,
             LEAST(COALESCE(c.amount, 0), round(COALESCE(c.amount, 0) * v_received / NULLIF(s.amount, 0), 2)) AS rel
        FROM public.commission_splits c
       WHERE c.sale_id = s.id AND c.status::text <> 'cancelado'
    ) x
   WHERE cs.id = x.id AND cs.released_amount IS DISTINCT FROM x.rel;

  UPDATE public.commissions cm
     SET released_amount = x.rel,
         workflow_status = CASE
                             WHEN COALESCE(cm.status::text, '') IN ('pago','paga') THEN cm.workflow_status
                             WHEN x.rel >= COALESCE(cm.amount, 0) AND COALESCE(cm.amount, 0) > 0 THEN 'liberada'
                             ELSE 'aguardando_confirmacao'
                           END,
         updated_at = now()
    FROM (
      SELECT c.id,
             LEAST(COALESCE(c.amount, 0), round(COALESCE(c.amount, 0) * v_received / NULLIF(s.amount, 0), 2)) AS rel
        FROM public.commissions c
       WHERE c.sale_id = s.id
         AND COALESCE(c.status::text, '') NOT IN ('cancelado','cancelada')
         AND c.payment_id IS NULL
    ) x
   WHERE cm.id = x.id AND cm.released_amount IS DISTINCT FROM x.rel;
END;
$$;
REVOKE ALL ON FUNCTION private.recompute_sale_release(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- Repasse de parcela sem venda: a função antiga nasce paga quando a parcela está paga.
CREATE OR REPLACE FUNCTION private.cash_split_no_auto_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 AND NEW.payment_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.commission_splits o
                WHERE o.payment_id = NEW.payment_id
                  AND o.beneficiary_type = NEW.beneficiary_type
                  AND o.beneficiary_id = NEW.beneficiary_id
                  AND o.status::text = 'pago') THEN
      RETURN NULL; -- já foi paga: não cria outra em aberto
    END IF;
    NEW.status := 'pendente'::split_status;
    NEW.paid_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_cash_split_no_auto_paid ON public.commission_splits;
CREATE TRIGGER trg_cash_split_no_auto_paid
  BEFORE INSERT ON public.commission_splits
  FOR EACH ROW EXECUTE FUNCTION private.cash_split_no_auto_paid();

-- ---------------------------------------------------------------------
-- 5) Histórico: registra no livro o que já está gravado.
--    Só acrescenta linhas; não muda nenhum valor antigo.
--    Repasse histórico fica "não confirmado" e fora do saldo, porque o sistema
--    marcava pago na primeira parcela do cliente, sem pagamento real.
-- ---------------------------------------------------------------------
INSERT INTO public.cash_settlements
  (direction, source_type, source_id, amount, effective_date, account_id, payment_method, origin, verified, notes)
SELECT 'entrada', 'payment', p.id,
       CASE WHEN COALESCE(p.amount_paid, 0) > 0 THEN p.amount_paid ELSE p.amount END,
       COALESCE((p.paid_at AT TIME ZONE 'America/Sao_Paulo')::date, p.due_date, (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date),
       private.cash_default_account(), p.payment_method, 'historico',
       -- Parcela em aberto com valor pago é contraditória: entra, mas sinalizada.
       p.status::text IN ('pago','paga','parcial','parcialmente_pago'),
       'Registrado a partir do histórico'
  FROM public.payments p
 WHERE p.status::text NOT IN ('cancelado','cancelada','reembolsado','estornado')
   AND (COALESCE(p.amount_paid, 0) > 0 OR p.status::text IN ('pago','paga'))
   AND (p.paid_at IS NULL OR (p.paid_at AT TIME ZONE 'America/Sao_Paulo')::date <= private.cash_today())
ON CONFLICT DO NOTHING;

INSERT INTO public.cash_settlements
  (direction, source_type, source_id, amount, effective_date, account_id, payment_method, origin, verified, notes)
SELECT 'saida', 'expense', e.id, e.amount,
       COALESCE(e.paid_at::date, e.expense_date),
       private.cash_default_account(), e.payment_method, 'historico', true, 'Registrado a partir do histórico'
  FROM public.expenses e
 WHERE COALESCE(e.paid, false) AND e.amount > 0
ON CONFLICT DO NOTHING;

INSERT INTO public.cash_settlements
  (direction, source_type, source_id, amount, effective_date, account_id, origin, verified, notes)
SELECT 'saida', 'commission_split', s.id, s.amount,
       COALESCE((s.paid_at AT TIME ZONE 'America/Sao_Paulo')::date, (s.updated_at AT TIME ZONE 'America/Sao_Paulo')::date),
       private.cash_default_account(), 'historico', false, 'Marcado como pago antes do livro de caixa: sem confirmação de pagamento real'
  FROM public.commission_splits s
 WHERE s.status::text = 'pago' AND s.amount > 0
ON CONFLICT DO NOTHING;

CREATE TRIGGER trg_cash_settlements_append_only
  BEFORE UPDATE OR DELETE ON public.cash_settlements
  FOR EACH ROW EXECUTE FUNCTION private.cash_settlements_append_only();

-- ---------------------------------------------------------------------
-- 6) Proteções e captura de baixas feitas direto nas tabelas antigas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.cash_guard_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := CASE TG_TABLE_NAME WHEN 'payments' THEN 'payment' WHEN 'expenses' THEN 'expense' ELSE 'commission_split' END;
  v_net numeric := private.cash_net_settled(v_type, OLD.id);
BEGIN
  IF v_net <= 0 OR current_setting('app.cash_ledger', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Este registro tem pagamento lançado. Estorne o pagamento antes de excluir.';
  END IF;
  IF NEW.amount < v_net THEN
    RAISE EXCEPTION 'O valor não pode ficar abaixo do que já foi liquidado (R$ %).', v_net;
  END IF;
  IF TG_TABLE_NAME = 'payments' THEN
    IF NEW.status::text IN ('cancelado','cancelada','reembolsado','estornado') THEN
      RAISE EXCEPTION 'Esta parcela tem pagamento lançado. Estorne ou devolva o pagamento antes de cancelar.';
    END IF;
  ELSIF TG_TABLE_NAME = 'commission_splits' THEN
    IF NEW.status::text = 'cancelado' THEN
      RAISE EXCEPTION 'Este repasse tem pagamento lançado. Estorne o pagamento antes de cancelar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.cash_capture_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target numeric;
  v_net numeric;
  v_date date;
BEGIN
  IF current_setting('app.cash_ledger', true) = 'on' THEN RETURN NULL; END IF;
  v_date := COALESCE((NEW.paid_at AT TIME ZONE 'America/Sao_Paulo')::date, private.cash_today());
  v_target := CASE
                WHEN NEW.status::text IN ('cancelado','cancelada','reembolsado','estornado') THEN 0
                WHEN NEW.paid_at IS NOT NULL AND v_date > private.cash_today() THEN 0 -- agendado: ainda não entrou
                WHEN COALESCE(NEW.amount_paid, 0) > 0 THEN NEW.amount_paid
                WHEN NEW.status::text IN ('pago','paga') THEN NEW.amount
                ELSE 0
              END;
  v_net := private.cash_net_settled('payment', NEW.id);
  IF v_target > v_net THEN
    INSERT INTO public.cash_settlements
      (direction, source_type, source_id, amount, effective_date, account_id, payment_method, origin, created_by, notes)
    VALUES ('entrada', 'payment', NEW.id, v_target - v_net, v_date, private.cash_default_account(),
            NEW.payment_method, 'captura', auth.uid(), 'Baixa registrada em outra tela');
  ELSIF v_target < v_net THEN
    PERFORM private.cash_reverse_amount('payment', NEW.id, v_net - v_target, 'estorno',
      'Baixa desfeita em outra tela', private.cash_today(), 'captura');
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.cash_capture_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric;
  v_date date;
BEGIN
  IF current_setting('app.cash_ledger', true) = 'on' THEN RETURN NULL; END IF;
  v_net := private.cash_net_settled('expense', NEW.id);
  IF COALESCE(NEW.paid, false) AND v_net < NEW.amount THEN
    v_date := COALESCE(NEW.paid_at::date, NEW.expense_date, private.cash_today());
    INSERT INTO public.cash_settlements
      (direction, source_type, source_id, amount, effective_date, account_id, payment_method, origin, created_by, notes)
    VALUES ('saida', 'expense', NEW.id, NEW.amount - v_net, v_date, private.cash_default_account(),
            NEW.payment_method, 'captura', auth.uid(), 'Pagamento registrado em outra tela');
  ELSIF NOT COALESCE(NEW.paid, false) AND TG_OP = 'UPDATE' AND COALESCE(OLD.paid, false) AND v_net > 0 THEN
    PERFORM private.cash_reverse_amount('expense', NEW.id, v_net, 'estorno',
      'Pagamento desfeito em outra tela', private.cash_today(), 'captura');
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.cash_capture_split()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric;
BEGIN
  IF current_setting('app.cash_ledger', true) = 'on' THEN RETURN NULL; END IF;
  v_net := private.cash_net_settled('commission_split', NEW.id);
  IF NEW.status::text = 'pago' AND v_net < NEW.amount THEN
    INSERT INTO public.cash_settlements
      (direction, source_type, source_id, amount, effective_date, account_id, origin, created_by, notes)
    VALUES ('saida', 'commission_split', NEW.id, NEW.amount - v_net,
            COALESCE((NEW.paid_at AT TIME ZONE 'America/Sao_Paulo')::date, private.cash_today()),
            private.cash_default_account(), 'captura', auth.uid(), 'Pagamento registrado em outra tela');
  ELSIF NEW.status::text = 'pendente' AND TG_OP = 'UPDATE' AND OLD.status::text = 'pago' AND v_net > 0 THEN
    PERFORM private.cash_reverse_amount('commission_split', NEW.id, v_net, 'estorno',
      'Pagamento desfeito em outra tela', private.cash_today(), 'captura');
  END IF;
  RETURN NULL;
END;
$$;

-- Comissão marcada pela tabela antiga: repassa ao split correspondente.
CREATE OR REPLACE FUNCTION private.cash_capture_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_id uuid;
  v_paid boolean := COALESCE(NEW.status::text, '') IN ('pago','paga');
  v_was boolean := COALESCE(OLD.status::text, '') IN ('pago','paga');
BEGIN
  IF current_setting('app.cash_ledger', true) = 'on' OR v_paid = v_was OR NEW.sale_id IS NULL OR NEW.payment_id IS NOT NULL THEN
    RETURN NULL;
  END IF;
  v_type := CASE WHEN NEW.partner_id IS NOT NULL THEN 'partner'
                 WHEN NEW.referrer_id IS NOT NULL THEN 'referrer'
                 WHEN NEW.collaborator_id IS NOT NULL THEN 'collaborator'
                 WHEN NEW.service_provider_id IS NOT NULL THEN 'service_provider' END;
  v_id := COALESCE(NEW.partner_id, NEW.referrer_id, NEW.collaborator_id, NEW.service_provider_id);
  IF v_type IS NULL THEN RETURN NULL; END IF;
  UPDATE public.commission_splits s
     SET status = CASE WHEN v_paid THEN 'pago'::split_status ELSE 'pendente'::split_status END,
         paid_at = CASE WHEN v_paid THEN COALESCE(NEW.paid_at, now()) END,
         updated_at = now()
   WHERE s.sale_id = NEW.sale_id AND s.beneficiary_type::text = v_type AND s.beneficiary_id = v_id
     AND s.status::text = CASE WHEN v_paid THEN 'pendente' ELSE 'pago' END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_guard ON public.payments;
CREATE TRIGGER trg_cash_guard BEFORE UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.cash_guard_source();
DROP TRIGGER IF EXISTS trg_cash_guard ON public.expenses;
CREATE TRIGGER trg_cash_guard BEFORE UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.cash_guard_source();
DROP TRIGGER IF EXISTS trg_cash_guard ON public.commission_splits;
CREATE TRIGGER trg_cash_guard BEFORE UPDATE OR DELETE ON public.commission_splits
  FOR EACH ROW EXECUTE FUNCTION private.cash_guard_source();

DROP TRIGGER IF EXISTS trg_cash_capture ON public.payments;
CREATE TRIGGER trg_cash_capture AFTER INSERT OR UPDATE OF status, amount_paid, paid_at ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.cash_capture_payment();
DROP TRIGGER IF EXISTS trg_cash_capture ON public.expenses;
CREATE TRIGGER trg_cash_capture AFTER INSERT OR UPDATE OF paid, paid_at ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.cash_capture_expense();
DROP TRIGGER IF EXISTS trg_cash_capture ON public.commission_splits;
CREATE TRIGGER trg_cash_capture AFTER INSERT OR UPDATE OF status ON public.commission_splits
  FOR EACH ROW EXECUTE FUNCTION private.cash_capture_split();
DROP TRIGGER IF EXISTS trg_cash_capture ON public.commissions;
CREATE TRIGGER trg_cash_capture AFTER UPDATE OF status ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION private.cash_capture_commission();

-- ---------------------------------------------------------------------
-- 7) Ações: receber, pagar, estornar
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cash_settle(
  p_source_type text,
  p_source_id uuid,
  p_amount numeric,
  p_effective_date date,
  p_payment_method text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_total numeric;
  v_net numeric;
  v_direction text;
  v_status text;
  v_auto boolean := false;
  v_id uuid;
BEGIN
  IF NOT private.can_operate_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para operar o caixa.';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.cash_settlements WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR round(p_amount, 2) <> p_amount THEN
    RAISE EXCEPTION 'Informe um valor maior que zero, com até 2 casas decimais.';
  END IF;
  IF p_effective_date IS NULL THEN
    RAISE EXCEPTION 'Informe a data efetiva.';
  END IF;
  IF p_effective_date > private.cash_today() THEN
    RAISE EXCEPTION 'A data efetiva não pode ser futura. Pagamento ainda não realizado continua como previsto.';
  END IF;

  -- A trava da linha faz dois usuários na mesma obrigação rodarem em fila.
  IF p_source_type = 'payment' THEN
    SELECT amount, status::text INTO v_total, v_status FROM public.payments WHERE id = p_source_id FOR UPDATE;
    v_direction := 'entrada';
  ELSIF p_source_type = 'other_income' THEN
    SELECT amount, CASE WHEN canceled_at IS NOT NULL THEN 'cancelado' ELSE 'pendente' END INTO v_total, v_status
      FROM public.cash_other_income WHERE id = p_source_id FOR UPDATE;
    v_direction := 'entrada';
  ELSIF p_source_type = 'expense' THEN
    SELECT amount, 'pendente', COALESCE(auto_provision, false) INTO v_total, v_status, v_auto
      FROM public.expenses WHERE id = p_source_id FOR UPDATE;
    v_direction := 'saida';
  ELSIF p_source_type = 'commission_split' THEN
    SELECT amount, status::text INTO v_total, v_status FROM public.commission_splits WHERE id = p_source_id FOR UPDATE;
    v_direction := 'saida';
  ELSE
    RAISE EXCEPTION 'Tipo de obrigação inválido.';
  END IF;

  IF v_total IS NULL THEN RAISE EXCEPTION 'Obrigação não encontrada.'; END IF;
  IF v_status IN ('cancelado','cancelada','reembolsado','estornado') THEN
    RAISE EXCEPTION 'Esta obrigação está cancelada.';
  END IF;

  -- Segunda checagem: outra sessão pode ter gravado a mesma chave enquanto esta esperava.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.cash_settlements WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  v_net := private.cash_net_settled(p_source_type, p_source_id);
  IF p_amount > v_total - v_net THEN
    RAISE EXCEPTION 'O valor excede o saldo em aberto (R$ %). Para pagamento a mais, registre o valor do saldo e lance o excedente nas próximas parcelas.', v_total - v_net;
  END IF;
  IF v_auto AND p_amount <> v_total - v_net THEN
    RAISE EXCEPTION 'Provisão automática só aceita pagamento integral, porque é recalculada quando a venda muda.';
  END IF;

  INSERT INTO public.cash_settlements
    (direction, source_type, source_id, amount, effective_date, account_id, payment_method, notes, idempotency_key, created_by)
  VALUES (v_direction, p_source_type, p_source_id, p_amount, p_effective_date, private.cash_default_account(),
          p_payment_method, p_notes, p_idempotency_key, auth.uid())
  RETURNING id INTO v_id;

  PERFORM private.cash_mirror_source(p_source_type, p_source_id);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_settle(text, uuid, numeric, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_settle(text, uuid, numeric, date, text, text, text) TO authenticated;

-- Recebimento informado na venda: abate as parcelas em aberto, da mais antiga para a mais nova.
-- Contrato com valor estimado e recebimentos variáveis: o que passar das parcelas vira uma
-- parcela nova, limitada ao saldo do contrato ainda sem cronograma.
CREATE OR REPLACE FUNCTION public.cash_receive_for_sale(
  p_sale_id uuid,
  p_amount numeric,
  p_effective_date date,
  p_payment_method text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_left numeric := p_amount;
  v_open numeric;
  v_take numeric;
  v_count integer := 0;
  v_sale record;
  v_unscheduled numeric;
  v_new_id uuid;
BEGIN
  IF NOT private.can_operate_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para operar o caixa.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR round(p_amount, 2) <> p_amount THEN
    RAISE EXCEPTION 'Informe um valor maior que zero, com até 2 casas decimais.';
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND status::text = 'concluida' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finalize a venda antes de registrar recebimentos.'; END IF;

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.cash_settlements WHERE idempotency_key LIKE p_idempotency_key || ':%') THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(p.amount - private.cash_net_settled('payment', p.id)), 0) INTO v_open
    FROM public.payments p
   WHERE p.sale_id = p_sale_id AND p.status::text NOT IN ('cancelado','cancelada','reembolsado','estornado');
  SELECT GREATEST(v_sale.amount - COALESCE(SUM(p.amount), 0), 0) INTO v_unscheduled
    FROM public.payments p
   WHERE p.sale_id = p_sale_id AND p.status::text NOT IN ('cancelado','cancelada','reembolsado','estornado');
  IF p_amount > v_open + v_unscheduled THEN
    RAISE EXCEPTION 'O valor excede o saldo do contrato (R$ %). Se o valor estimado mudou, ajuste o valor da venda antes de registrar.', v_open + v_unscheduled;
  END IF;

  FOR r IN
    SELECT p.id, p.amount - private.cash_net_settled('payment', p.id) AS bal
      FROM public.payments p
     WHERE p.sale_id = p_sale_id AND p.status::text NOT IN ('cancelado','cancelada','reembolsado','estornado')
     ORDER BY p.due_date NULLS LAST, p.installment_number NULLS LAST, p.created_at, p.id
  LOOP
    EXIT WHEN v_left <= 0;
    CONTINUE WHEN r.bal <= 0;
    v_take := LEAST(v_left, r.bal);
    PERFORM public.cash_settle('payment', r.id, v_take, p_effective_date, p_payment_method, p_notes,
      CASE WHEN p_idempotency_key IS NOT NULL THEN p_idempotency_key || ':' || r.id END);
    v_left := v_left - v_take;
    v_count := v_count + 1;
  END LOOP;

  IF v_left > 0 THEN
    INSERT INTO public.payments (sale_id, client_id, product_id, amount, due_date, status, description)
    VALUES (p_sale_id, v_sale.client_id, v_sale.product_id, v_left, p_effective_date, 'pendente'::payment_status,
            'Recebimento variável do contrato')
    RETURNING id INTO v_new_id;
    PERFORM public.cash_settle('payment', v_new_id, v_left, p_effective_date, p_payment_method, p_notes,
      CASE WHEN p_idempotency_key IS NOT NULL THEN p_idempotency_key || ':' || v_new_id END);
    v_count := v_count + 1;
  END IF;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_receive_for_sale(uuid, numeric, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_receive_for_sale(uuid, numeric, date, text, text, text) TO authenticated;

-- Estorno: o pagamento não aconteceu; reabre o saldo.
-- Devolução: o dinheiro voltou ao cliente; a parcela é encerrada como reembolsada.
CREATE OR REPLACE FUNCTION public.cash_reverse(
  p_settlement_id uuid,
  p_amount numeric,
  p_reason text,
  p_effective_date date DEFAULT NULL,
  p_kind text DEFAULT 'estorno',
  p_idempotency_key text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  v_existing uuid;
  v_open numeric;
  v_date date := COALESCE(p_effective_date, private.cash_today());
  v_id uuid;
BEGIN
  IF NOT private.can_operate_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para operar o caixa.';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Informe o motivo.';
  END IF;
  IF p_kind NOT IN ('estorno','devolucao') THEN
    RAISE EXCEPTION 'Tipo inválido.';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.cash_settlements WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  SELECT * INTO s FROM public.cash_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND OR s.kind <> 'liquidacao' THEN
    RAISE EXCEPTION 'Lançamento não encontrado ou não pode ser estornado.';
  END IF;
  IF v_date > private.cash_today() THEN
    RAISE EXCEPTION 'A data do estorno não pode ser futura.';
  END IF;
  IF v_date < s.effective_date THEN
    RAISE EXCEPTION 'A data do estorno não pode ser anterior à do pagamento.';
  END IF;

  SELECT s.amount - COALESCE(SUM(x.amount), 0) INTO v_open
    FROM public.cash_settlements x WHERE x.reverses_id = s.id;
  IF p_amount IS NULL OR p_amount <= 0 OR round(p_amount, 2) <> p_amount OR p_amount > v_open THEN
    RAISE EXCEPTION 'O valor deve ser maior que zero e até R$ %.', v_open;
  END IF;

  INSERT INTO public.cash_settlements
    (direction, source_type, source_id, kind, reverses_id, amount, effective_date, account_id, reason, origin, verified, idempotency_key, created_by)
  VALUES (s.direction, s.source_type, s.source_id, p_kind, s.id, p_amount, v_date, s.account_id, p_reason, 'acao', s.verified, p_idempotency_key, auth.uid())
  RETURNING id INTO v_id;

  PERFORM private.cash_mirror_source(s.source_type, s.source_id);

  IF p_kind = 'devolucao' AND s.source_type = 'payment' THEN
    PERFORM set_config('app.cash_ledger', 'on', true);
    UPDATE public.payments
       SET refund_amount = COALESCE(refund_amount, 0) + p_amount,
           refunded_at = now(),
           status = CASE WHEN private.cash_net_settled('payment', id) <= 0 THEN 'reembolsado'::payment_status ELSE status END
     WHERE id = s.source_id;
    PERFORM set_config('app.cash_ledger', 'off', true);
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_reverse(uuid, numeric, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_reverse(uuid, numeric, text, date, text, text) TO authenticated;

-- Estorna tudo o que está liquidado em uma obrigação (usado na tela de recebimentos da venda).
-- Linha antiga criada por "Registrar Recebimento" é cancelada depois, porque nunca foi parcela.
CREATE OR REPLACE FUNCTION public.cash_reverse_source(p_source_type text, p_source_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric;
BEGIN
  IF NOT private.can_operate_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para operar o caixa.';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
  IF p_source_type = 'payment' THEN
    PERFORM 1 FROM public.payments WHERE id = p_source_id FOR UPDATE;
  END IF;
  v_net := private.cash_net_settled(p_source_type, p_source_id);
  IF v_net <= 0 THEN RAISE EXCEPTION 'Não há pagamento para estornar.'; END IF;
  PERFORM private.cash_reverse_amount(p_source_type, p_source_id, v_net, 'estorno', p_reason, private.cash_today(), 'acao');
  PERFORM private.cash_mirror_source(p_source_type, p_source_id);
  IF p_source_type = 'payment' THEN
    PERFORM set_config('app.cash_ledger', 'on', true);
    UPDATE public.payments
       SET status = 'cancelado'::payment_status, cancellation_reason = p_reason
     WHERE id = p_source_id AND description ILIKE 'Recebimento%';
    PERFORM set_config('app.cash_ledger', 'off', true);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_reverse_source(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_reverse_source(text, uuid, text) TO authenticated;

-- Dinheiro devolvido ao cliente: sai do caixa e não volta a ser cobrado se a parcela ficar zerada.
CREATE OR REPLACE FUNCTION public.cash_refund_payment(p_payment_id uuid, p_amount numeric, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric;
BEGIN
  IF NOT private.can_operate_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para operar o caixa.';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
  PERFORM 1 FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  v_net := private.cash_net_settled('payment', p_payment_id);
  IF p_amount IS NULL OR p_amount <= 0 OR round(p_amount, 2) <> p_amount OR p_amount > v_net THEN
    RAISE EXCEPTION 'O valor deve ser maior que zero e até R$ %.', v_net;
  END IF;
  PERFORM private.cash_reverse_amount('payment', p_payment_id, p_amount, 'devolucao', p_reason, private.cash_today(), 'acao');
  PERFORM private.cash_mirror_source('payment', p_payment_id);
  PERFORM set_config('app.cash_ledger', 'on', true);
  UPDATE public.payments
     SET refund_amount = COALESCE(refund_amount, 0) + p_amount,
         refunded_at = now(),
         status = CASE WHEN private.cash_net_settled('payment', id) <= 0 THEN 'reembolsado'::payment_status ELSE status END
   WHERE id = p_payment_id;
  PERFORM set_config('app.cash_ledger', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION public.cash_refund_payment(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_refund_payment(uuid, numeric, text) TO authenticated;

-- Venda recorrente antiga gravada com o valor MENSAL: passa a ter o valor total do contrato,
-- que é o significado de sales.amount em todo o sistema. As parcelas não mudam. A comissão é
-- recalculada sobre o contrato pelos gatilhos da venda, preservando o que já foi pago.
-- Só deve ser chamada para venda confirmada pelo usuário, uma a uma.
CREATE TABLE IF NOT EXISTS public.cash_sale_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL UNIQUE REFERENCES public.sales(id),
  old_amount numeric(14,2) NOT NULL,
  new_amount numeric(14,2) NOT NULL,
  old_zenon_cost numeric(14,2),
  old_provider_cost numeric(14,2),
  months integer NOT NULL,
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_sale_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cash_sale_adjustments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.cash_sale_adjustments FROM authenticated;
GRANT SELECT ON public.cash_sale_adjustments TO authenticated;
DROP POLICY IF EXISTS "Cash viewers read" ON public.cash_sale_adjustments;
CREATE POLICY "Cash viewers read" ON public.cash_sale_adjustments FOR SELECT TO authenticated
  USING (private.can_access_cash(auth.uid()));

CREATE OR REPLACE FUNCTION public.cash_convert_monthly_sale(p_sale_id uuid, p_reason text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  v_months integer;
BEGIN
  -- Pelo sistema: só admin. Pelo SQL do banco (dono), não há usuário logado.
  IF session_user IN ('authenticator','anon','authenticated') AND NOT private.can_access_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir vendas.';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;

  SELECT * INTO s FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada.'; END IF;
  IF s.revenue_type IS DISTINCT FROM 'recorrente' OR COALESCE(s.recurrence_months, 0) <= 1 THEN
    RAISE EXCEPTION 'Só venda recorrente com mais de um mês pode ser convertida.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cash_sale_adjustments WHERE sale_id = p_sale_id) THEN
    RAISE EXCEPTION 'Esta venda já foi convertida.';
  END IF;
  v_months := s.recurrence_months;

  INSERT INTO public.cash_sale_adjustments (sale_id, old_amount, new_amount, old_zenon_cost, old_provider_cost, months, reason, created_by)
  VALUES (p_sale_id, s.amount, s.amount * v_months, s.zenon_cost, s.provider_cost, v_months, p_reason, auth.uid());

  -- Custos em valor fixo acompanham o contrato. Percentuais são recalculados sobre o novo total.
  UPDATE public.sale_deductions SET fixed_amount = fixed_amount * v_months
   WHERE sale_id = p_sale_id AND fixed_amount IS NOT NULL;

  UPDATE public.sales
     SET amount = s.amount * v_months,
         zenon_cost = COALESCE(s.zenon_cost, 0) * v_months,
         provider_cost = COALESCE(s.provider_cost, 0) * v_months
   WHERE id = p_sale_id;
  RETURN s.amount * v_months;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_convert_monthly_sale(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_convert_monthly_sale(uuid, text) TO authenticated;

-- Confirma que um pagamento histórico sinalizado aconteceu de verdade.
CREATE OR REPLACE FUNCTION public.cash_confirm_historic(p_settlement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.can_operate_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para operar o caixa.';
  END IF;
  UPDATE public.cash_settlements SET verified = true WHERE id = p_settlement_id AND NOT verified;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_confirm_historic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_confirm_historic(uuid) TO authenticated;

-- Saída avulsa usa expenses, entrada avulsa usa cash_other_income.
CREATE OR REPLACE FUNCTION public.cash_create_entry(
  p_direction text,
  p_description text,
  p_amount numeric,
  p_date date,
  p_realized boolean,
  p_category text DEFAULT NULL,
  p_counterparty text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_key text := CASE WHEN p_idempotency_key IS NOT NULL THEN p_idempotency_key || ':entry' END;
BEGIN
  IF NOT private.can_access_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para operar o caixa.';
  END IF;
  IF v_key IS NOT NULL THEN
    SELECT source_id INTO v_id FROM public.cash_settlements WHERE idempotency_key = v_key;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;
  IF length(trim(COALESCE(p_description, ''))) = 0 THEN RAISE EXCEPTION 'Informe a descrição.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR round(p_amount, 2) <> p_amount THEN
    RAISE EXCEPTION 'Informe um valor maior que zero, com até 2 casas decimais.';
  END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'Informe a data.'; END IF;
  IF p_realized AND p_date > private.cash_today() THEN
    RAISE EXCEPTION 'Lançamento realizado não pode ter data futura.';
  END IF;

  IF p_direction = 'entrada' THEN
    INSERT INTO public.cash_other_income (description, amount, due_date, nature, counterparty, client_id, notes, created_by)
    VALUES (p_description, p_amount, p_date, COALESCE(p_category, 'outras_receitas'), p_counterparty, p_client_id, p_notes, auth.uid())
    RETURNING id INTO v_id;
    IF p_realized THEN
      PERFORM public.cash_settle('other_income', v_id, p_amount, p_date, p_payment_method, NULL, v_key);
    END IF;
  ELSIF p_direction = 'saida' THEN
    PERFORM set_config('app.cash_ledger', 'on', true);
    INSERT INTO public.expenses (description, category, amount, expense_date, due_date, reference_month, vendor, notes, paid, created_by)
    VALUES (p_description, COALESCE(p_category, 'Outros'), p_amount, p_date, p_date, date_trunc('month', p_date)::date,
            p_counterparty, p_notes, false, auth.uid())
    RETURNING id INTO v_id;
    PERFORM set_config('app.cash_ledger', 'off', true);
    IF p_realized THEN
      PERFORM public.cash_settle('expense', v_id, p_amount, p_date, p_payment_method, NULL, v_key);
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo inválido.';
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_create_entry(text, text, numeric, date, boolean, text, text, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_create_entry(text, text, numeric, date, boolean, text, text, uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cash_cancel_income(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.can_access_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para operar o caixa.';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
  IF private.cash_net_settled('other_income', p_id) > 0 THEN
    RAISE EXCEPTION 'Esta entrada tem recebimento lançado. Estorne antes de cancelar.';
  END IF;
  UPDATE public.cash_other_income SET canceled_at = now(), canceled_reason = p_reason WHERE id = p_id AND canceled_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_cancel_income(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_cancel_income(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cash_set_opening_balance(p_reference_date date, p_amount numeric, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT private.can_access_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para operar o caixa.';
  END IF;
  IF p_reference_date IS NULL OR p_reference_date > private.cash_today() THEN
    RAISE EXCEPTION 'A data do saldo não pode ser futura.';
  END IF;
  IF p_amount IS NULL OR round(p_amount, 2) <> p_amount THEN RAISE EXCEPTION 'Valor inválido.'; END IF;
  INSERT INTO public.cash_opening_balances (account_id, reference_date, amount, reason, created_by)
  VALUES (private.cash_default_account(), p_reference_date, p_amount, p_reason, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cash_set_opening_balance(date, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_set_opening_balance(date, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 8) Leitura
-- ---------------------------------------------------------------------
-- Todas as obrigações, com saldo. Só parcelas de venda concluída ou sem venda
-- entram na previsão: venda em negociação é expectativa, sem fluxo de caixa.
CREATE OR REPLACE FUNCTION private.cash_obligations()
RETURNS TABLE (
  source_type text, source_id uuid, direction text, description text, counterparty text,
  origin_label text, sale_id uuid, client_id uuid, due_date date, amount numeric, settled numeric, balance numeric,
  is_estimate boolean, in_projection boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'payment', p.id, 'entrada',
         COALESCE(NULLIF(trim(pr.name), ''), NULLIF(trim(p.description), ''), 'Parcela'),
         COALESCE(NULLIF(trim(c.company), ''), c.full_name),
         CASE WHEN p.sale_id IS NULL THEN 'Cobrança avulsa'
              WHEN COALESCE(p.installments_count, 1) > 1 THEN 'Venda · parcela ' || COALESCE(p.installment_number::text, '?') || '/' || p.installments_count
              ELSE 'Venda' END,
         p.sale_id, p.client_id, p.due_date, p.amount, n.net, GREATEST(p.amount - n.net, 0),
         false, (p.sale_id IS NULL OR s.status::text = 'concluida')
    FROM public.payments p
    LEFT JOIN public.sales s ON s.id = p.sale_id
    LEFT JOIN public.clients c ON c.id = p.client_id
    LEFT JOIN public.products pr ON pr.id = p.product_id
    CROSS JOIN LATERAL (SELECT private.cash_net_settled('payment', p.id) AS net) n
   WHERE p.status::text NOT IN ('cancelado','cancelada','reembolsado','estornado') OR n.net > 0
  UNION ALL
  SELECT 'other_income', i.id, 'entrada', i.description, COALESCE(i.counterparty, c.full_name),
         'Entrada avulsa', NULL, i.client_id, i.due_date, i.amount, n.net, GREATEST(i.amount - n.net, 0), false, true
    FROM public.cash_other_income i
    LEFT JOIN public.clients c ON c.id = i.client_id
    CROSS JOIN LATERAL (SELECT private.cash_net_settled('other_income', i.id) AS net) n
   WHERE i.canceled_at IS NULL OR n.net > 0
  UNION ALL
  SELECT 'expense', e.id, 'saida', e.description, e.vendor,
         CASE WHEN COALESCE(e.auto_provision, false) THEN 'Provisão de venda (estimativa)' ELSE 'Despesa' END,
         e.sale_id, NULL, COALESCE(e.due_date, e.expense_date), e.amount, n.net, GREATEST(e.amount - n.net, 0),
         COALESCE(e.auto_provision, false), true
    FROM public.expenses e
    CROSS JOIN LATERAL (SELECT private.cash_net_settled('expense', e.id) AS net) n
  UNION ALL
  -- Repasse a pagar: só o que já foi liberado pelo recebimento do cliente.
  -- Vence na data do último recebimento da venda.
  SELECT 'commission_split', k.id, 'saida',
         CASE k.beneficiary_type::text WHEN 'partner' THEN 'Comissão de parceiro'
              WHEN 'referrer' THEN 'Comissão de indicador'
              WHEN 'collaborator' THEN 'Comissão de colaborador'
              ELSE 'Repasse a prestador' END,
         COALESCE(pa.full_name, re.full_name, sp.name, co.full_name),
         'Comissão', k.sale_id, k.client_id,
         COALESCE(lr.d, (k.created_at AT TIME ZONE 'America/Sao_Paulo')::date),
         CASE WHEN k.sale_id IS NULL THEN k.amount ELSE COALESCE(k.released_amount, 0) END,
         n.net,
         GREATEST(CASE WHEN k.sale_id IS NULL THEN k.amount ELSE COALESCE(k.released_amount, 0) END - n.net, 0),
         false, true
    FROM public.commission_splits k
    LEFT JOIN public.partners pa ON k.beneficiary_type::text = 'partner' AND pa.id = k.beneficiary_id
    LEFT JOIN public.referrers re ON k.beneficiary_type::text = 'referrer' AND re.id = k.beneficiary_id
    LEFT JOIN public.service_providers sp ON k.beneficiary_type::text = 'service_provider' AND sp.id = k.beneficiary_id
    LEFT JOIN public.profiles co ON k.beneficiary_type::text = 'collaborator' AND co.id = k.beneficiary_id
    CROSS JOIN LATERAL (SELECT private.cash_net_settled('commission_split', k.id) AS net) n
    LEFT JOIN LATERAL (
      SELECT MAX(x.effective_date) AS d
        FROM public.cash_settlements x
        JOIN public.payments pp ON x.source_type = 'payment' AND pp.id = x.source_id
       WHERE pp.sale_id = k.sale_id AND x.kind = 'liquidacao'
    ) lr ON true
   WHERE (k.status::text <> 'cancelado' OR n.net > 0)
     AND (n.net > 0 OR (CASE WHEN k.sale_id IS NULL THEN k.amount ELSE COALESCE(k.released_amount, 0) END) > 0)
$$;
REVOKE ALL ON FUNCTION private.cash_obligations() FROM PUBLIC, anon, authenticated;

-- Soma de movimentos com sinal, ignorando histórico não confirmado.
CREATE OR REPLACE FUNCTION private.cash_movement(p_from date, p_to date)
RETURNS TABLE (entradas numeric, saidas numeric, nao_confirmado numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'entrada' AND (verified OR source_type <> 'commission_split')
                      THEN CASE WHEN kind = 'liquidacao' THEN amount ELSE -amount END END), 0),
    COALESCE(SUM(CASE WHEN direction = 'saida' AND (verified OR source_type <> 'commission_split')
                      THEN CASE WHEN kind = 'liquidacao' THEN amount ELSE -amount END END), 0),
    COALESCE(SUM(CASE WHEN NOT verified AND source_type = 'commission_split'
                      THEN CASE WHEN kind = 'liquidacao' THEN amount ELSE -amount END END), 0)
    FROM public.cash_settlements
   WHERE effective_date BETWEEN p_from AND p_to
$$;
REVOKE ALL ON FUNCTION private.cash_movement(date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cash_month(p_month date, p_include_overdue boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_today date := private.cash_today();
  v_period text;
  v_cutoff date;
  ob record;
  m record;
  v_opening numeric;
  v_before numeric;
  v_after numeric;
  v_saldo numeric;
  v_real_today numeric;
  v_in numeric;
  v_out numeric;
  v_over_in numeric;
  v_over_out numeric;
  v_projected numeric;
  v_opening_projected boolean := false;
BEGIN
  IF NOT private.can_access_cash(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para ver o caixa.';
  END IF;

  v_period := CASE WHEN v_end < v_today THEN 'passado' WHEN v_start > v_today THEN 'futuro' ELSE 'atual' END;
  v_cutoff := LEAST(v_end, v_today);

  SELECT * INTO m FROM private.cash_movement(v_start, v_cutoff);

  SELECT * INTO ob FROM public.cash_opening_balances
   WHERE account_id = private.cash_default_account()
   ORDER BY created_at DESC LIMIT 1;

  -- Pendências elegíveis deste mês
  SELECT COALESCE(SUM(balance) FILTER (WHERE direction = 'entrada'), 0),
         COALESCE(SUM(balance) FILTER (WHERE direction = 'saida'), 0)
    INTO v_in, v_out
    FROM private.cash_obligations()
   WHERE in_projection AND due_date BETWEEN v_start AND v_end;

  -- Atrasados: vencidos e não quitados até hoje, de qualquer mês
  SELECT COALESCE(SUM(balance) FILTER (WHERE direction = 'entrada'), 0),
         COALESCE(SUM(balance) FILTER (WHERE direction = 'saida'), 0)
    INTO v_over_in, v_over_out
    FROM private.cash_obligations()
   WHERE in_projection AND balance > 0 AND due_date < v_today;

  IF ob.id IS NOT NULL THEN
    -- Saldo em uma data = saldo informado + o que veio depois dele − o que veio antes até a data.
    SELECT (entradas - saidas) INTO v_after
      FROM private.cash_movement(ob.reference_date + 1, GREATEST(v_start - 1, ob.reference_date));
    SELECT (entradas - saidas) INTO v_before
      FROM private.cash_movement(v_start, GREATEST(ob.reference_date, v_start - 1));
    v_opening := ob.amount + COALESCE(v_after, 0) - COALESCE(v_before, 0);

    IF v_period = 'futuro' THEN
      -- Mês futuro: parte do saldo de hoje mais o previsto até o mês anterior.
      v_opening_projected := true;
      SELECT ob.amount + (entradas - saidas) INTO v_real_today
        FROM private.cash_movement(ob.reference_date + 1, v_today);
      SELECT v_real_today
             + COALESCE(SUM(balance) FILTER (WHERE direction = 'entrada'), 0)
             - COALESCE(SUM(balance) FILTER (WHERE direction = 'saida'), 0)
        INTO v_opening
        FROM private.cash_obligations()
       WHERE in_projection AND due_date BETWEEN date_trunc('month', v_today)::date AND v_start - 1;
    END IF;

    v_saldo := v_opening + m.entradas - m.saidas;
    v_projected := CASE WHEN v_period = 'passado' THEN v_saldo
                        ELSE v_saldo + v_in - v_out
                             + CASE WHEN p_include_overdue THEN
                                 COALESCE((SELECT SUM(CASE WHEN direction = 'entrada' THEN balance ELSE -balance END)
                                             FROM private.cash_obligations()
                                            WHERE in_projection AND balance > 0 AND due_date < LEAST(v_start, date_trunc('month', v_today)::date)), 0)
                               ELSE 0 END
                   END;
  END IF;

  RETURN jsonb_build_object(
    'month', to_char(v_start, 'YYYY-MM'),
    'period', v_period,
    'cutoff', v_cutoff,
    'include_overdue', p_include_overdue,
    'opening_configured', ob.id IS NOT NULL,
    'opening_reference_date', ob.reference_date,
    'opening', v_opening,
    'opening_projected', v_opening_projected,
    'entradas_realizadas', m.entradas,
    'saidas_realizadas', m.saidas,
    'resultado_realizado', m.entradas - m.saidas,
    'saldo_realizado', v_saldo,
    'entradas_pendentes', v_in,
    'saidas_pendentes', v_out,
    'saldo_projetado', v_projected,
    'atrasados_receber', v_over_in,
    'atrasados_pagar', v_over_out,
    -- Contratos concluídos com valor maior que a soma das parcelas: dinheiro esperado, sem data.
    'saldo_sem_cronograma', (
      SELECT COALESCE(SUM(GREATEST(s.amount - COALESCE(a.total, 0), 0)), 0)
        FROM public.sales s
        LEFT JOIN LATERAL (
          SELECT SUM(p.amount) AS total FROM public.payments p
           WHERE p.sale_id = s.id AND p.status::text NOT IN ('cancelado','cancelada','reembolsado','estornado')
        ) a ON true
       WHERE s.status::text = 'concluida'),
    'nao_confirmado', m.nao_confirmado,
    'vendido_mes', (SELECT COALESCE(SUM(amount), 0) FROM public.sales
                     WHERE status::text = 'concluida' AND sale_date BETWEEN v_start AND v_end),
    'lancamentos_sinalizados', (SELECT COUNT(*) FROM public.cash_settlements WHERE NOT verified AND kind = 'liquidacao'),
    'lines', COALESCE((
      SELECT jsonb_agg(l ORDER BY l.due_date, l.description)
        FROM (
          SELECT o.*,
                 lq.effective_in_month,
                 lq.last_effective,
                 CASE WHEN o.balance <= 0 THEN 'liquidado'
                      WHEN o.settled > 0 THEN CASE WHEN o.due_date < v_today THEN 'parcial_atrasado' ELSE 'parcial' END
                      WHEN o.due_date < v_today THEN 'atrasado'
                      ELSE 'pendente' END AS situation,
                 (o.due_date < v_start) AS from_previous_month
            FROM private.cash_obligations() o
            LEFT JOIN LATERAL (
              SELECT COALESCE(SUM(CASE WHEN x.kind = 'liquidacao' THEN x.amount ELSE -x.amount END)
                       FILTER (WHERE x.effective_date BETWEEN v_start AND v_end), 0) AS effective_in_month,
                     MAX(x.effective_date) FILTER (WHERE x.kind = 'liquidacao') AS last_effective
                FROM public.cash_settlements x
               WHERE x.source_type = o.source_type AND x.source_id = o.source_id
            ) lq ON true
           WHERE o.due_date BETWEEN v_start AND v_end
              OR EXISTS (SELECT 1 FROM public.cash_settlements x
                          WHERE x.source_type = o.source_type AND x.source_id = o.source_id
                            AND x.effective_date BETWEEN v_start AND v_end)
              OR (o.in_projection AND o.balance > 0 AND o.due_date < v_start)
        ) l
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.cash_month(date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_month(date, boolean) TO authenticated;
