
-- 1) Revogar EXECUTE de anon em funções SECURITY DEFINER públicas (mantém só authenticated)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 2) Unique email em profiles (case-insensitive) — somente onde não há duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_uidx
  ON public.profiles ((lower(email))) WHERE email IS NOT NULL;

-- 3) Unique commission_rules (parceiro+produto+tipo) evita duplicação acidental
CREATE UNIQUE INDEX IF NOT EXISTS commission_rules_unique_combo
  ON public.commission_rules (partner_id, product_id, rule_type);

-- 4) CHECK percent 0..100 em commissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_percent_range_chk') THEN
    ALTER TABLE public.commissions
      ADD CONSTRAINT commissions_percent_range_chk
      CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100)) NOT VALID;
  END IF;
END $$;

-- 5) Trigger: ao virar status=pago, preencher paid_at e approval_date
CREATE OR REPLACE FUNCTION public.commissions_set_paid_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'pago' OR NEW.status::text = 'paga' THEN
    IF NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
    IF NEW.approval_date IS NULL THEN NEW.approval_date := now(); END IF;
    IF NEW.payment_date IS NULL THEN NEW.payment_date := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commissions_set_paid_dates ON public.commissions;
CREATE TRIGGER trg_commissions_set_paid_dates
  BEFORE INSERT OR UPDATE OF status ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.commissions_set_paid_dates();

-- 6) Lead history automático ao mudar status/responsável
CREATE OR REPLACE FUNCTION public.log_lead_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_history (lead_id, action, new_data, user_id)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.responsible_id IS DISTINCT FROM OLD.responsible_id THEN
      INSERT INTO public.lead_history (lead_id, action, old_data, new_data, user_id)
      VALUES (
        NEW.id,
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_changed' ELSE 'reassigned' END,
        jsonb_build_object('status', OLD.status, 'responsible_id', OLD.responsible_id),
        jsonb_build_object('status', NEW.status, 'responsible_id', NEW.responsible_id),
        auth.uid()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Só cria o trigger se a tabela lead_history existir com as colunas esperadas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='lead_history')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_history' AND column_name='action') THEN
    DROP TRIGGER IF EXISTS trg_log_lead_change ON public.leads;
    CREATE TRIGGER trg_log_lead_change
      AFTER INSERT OR UPDATE ON public.leads
      FOR EACH ROW EXECUTE FUNCTION public.log_lead_change();
  END IF;
END $$;
