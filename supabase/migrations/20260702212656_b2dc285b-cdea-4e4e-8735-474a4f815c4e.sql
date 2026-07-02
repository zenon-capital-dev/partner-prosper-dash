
-- Audit tables for payments and commissions
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  sale_id uuid,
  client_id uuid,
  event text NOT NULL, -- 'created' | 'status_changed' | 'amount_paid_changed' | 'deleted'
  old_status text,
  new_status text,
  old_amount_paid numeric,
  new_amount_paid numeric,
  amount numeric,
  actor_id uuid,
  actor_email text,
  source text, -- 'trigger' | edge function name, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_audit_log TO authenticated;
GRANT ALL ON public.payment_audit_log TO service_role;
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment audit"
  ON public.payment_audit_log FOR SELECT TO authenticated
  USING (private.is_admin());
CREATE INDEX IF NOT EXISTS payment_audit_log_payment_idx ON public.payment_audit_log(payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_audit_log_sale_idx ON public.payment_audit_log(sale_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.commission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL, -- 'commissions' | 'commission_splits'
  source_id uuid NOT NULL,
  sale_id uuid,
  payment_id uuid,
  beneficiary_type text, -- 'partner' | 'referrer' | 'collaborator' | 'service_provider'
  beneficiary_id uuid,
  event text NOT NULL, -- 'created' | 'status_changed' | 'paid' | 'deleted'
  old_status text,
  new_status text,
  amount numeric,
  percent numeric,
  actor_id uuid,
  actor_email text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commission_audit_log TO authenticated;
GRANT ALL ON public.commission_audit_log TO service_role;
ALTER TABLE public.commission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read commission audit"
  ON public.commission_audit_log FOR SELECT TO authenticated
  USING (private.is_admin());
CREATE INDEX IF NOT EXISTS commission_audit_log_source_idx ON public.commission_audit_log(source_table, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commission_audit_log_sale_idx ON public.commission_audit_log(sale_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commission_audit_log_beneficiary_idx ON public.commission_audit_log(beneficiary_type, beneficiary_id, created_at DESC);

-- Helper to read actor email cheaply (SECURITY DEFINER — reads auth.users)
CREATE OR REPLACE FUNCTION private.actor_email(_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = _uid
$$;

-- ==== Trigger: payments audit ====
CREATE OR REPLACE FUNCTION public.trg_payments_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := private.actor_email(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_audit_log(payment_id, sale_id, client_id, event, new_status, new_amount_paid, amount, actor_id, actor_email, source)
    VALUES (NEW.id, NEW.sale_id, NEW.client_id, 'created', NEW.status::text, NEW.amount_paid, NEW.amount, v_actor, v_email, 'trigger');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.status::text,'') IS DISTINCT FROM COALESCE(OLD.status::text,'') THEN
      INSERT INTO public.payment_audit_log(payment_id, sale_id, client_id, event, old_status, new_status, old_amount_paid, new_amount_paid, amount, actor_id, actor_email, source)
      VALUES (NEW.id, NEW.sale_id, NEW.client_id, 'status_changed', OLD.status::text, NEW.status::text, OLD.amount_paid, NEW.amount_paid, NEW.amount, v_actor, v_email, 'trigger');
    END IF;
    IF COALESCE(NEW.amount_paid,0) IS DISTINCT FROM COALESCE(OLD.amount_paid,0) THEN
      INSERT INTO public.payment_audit_log(payment_id, sale_id, client_id, event, old_status, new_status, old_amount_paid, new_amount_paid, amount, actor_id, actor_email, source)
      VALUES (NEW.id, NEW.sale_id, NEW.client_id, 'amount_paid_changed', OLD.status::text, NEW.status::text, OLD.amount_paid, NEW.amount_paid, NEW.amount, v_actor, v_email, 'trigger');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.payment_audit_log(payment_id, sale_id, client_id, event, old_status, old_amount_paid, amount, actor_id, actor_email, source)
    VALUES (OLD.id, OLD.sale_id, OLD.client_id, 'deleted', OLD.status::text, OLD.amount_paid, OLD.amount, v_actor, v_email, 'trigger');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS payments_audit_trg ON public.payments;
CREATE TRIGGER payments_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_payments_audit();

-- ==== Trigger: commissions audit ====
CREATE OR REPLACE FUNCTION public.trg_commissions_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := private.actor_email(auth.uid());
  v_bt text;
  v_bid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_bt  := CASE WHEN NEW.partner_id IS NOT NULL THEN 'partner'
                  WHEN NEW.collaborator_id IS NOT NULL THEN 'collaborator'
                  WHEN NEW.referrer_id IS NOT NULL THEN 'referrer'
                  WHEN NEW.service_provider_id IS NOT NULL THEN 'service_provider' END;
    v_bid := COALESCE(NEW.partner_id, NEW.collaborator_id, NEW.referrer_id, NEW.service_provider_id);
    INSERT INTO public.commission_audit_log(source_table, source_id, sale_id, payment_id, beneficiary_type, beneficiary_id, event, new_status, amount, percent, actor_id, actor_email, source)
    VALUES ('commissions', NEW.id, NEW.sale_id, NEW.payment_id, v_bt, v_bid, 'created', NEW.status::text, NEW.amount, NEW.percent, v_actor, v_email, 'trigger');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_bt  := CASE WHEN NEW.partner_id IS NOT NULL THEN 'partner'
                  WHEN NEW.collaborator_id IS NOT NULL THEN 'collaborator'
                  WHEN NEW.referrer_id IS NOT NULL THEN 'referrer'
                  WHEN NEW.service_provider_id IS NOT NULL THEN 'service_provider' END;
    v_bid := COALESCE(NEW.partner_id, NEW.collaborator_id, NEW.referrer_id, NEW.service_provider_id);
    IF COALESCE(NEW.status::text,'') IS DISTINCT FROM COALESCE(OLD.status::text,'') THEN
      INSERT INTO public.commission_audit_log(source_table, source_id, sale_id, payment_id, beneficiary_type, beneficiary_id, event, old_status, new_status, amount, percent, actor_id, actor_email, source)
      VALUES ('commissions', NEW.id, NEW.sale_id, NEW.payment_id, v_bt, v_bid,
              CASE WHEN NEW.status::text IN ('pago','paga') THEN 'paid' ELSE 'status_changed' END,
              OLD.status::text, NEW.status::text, NEW.amount, NEW.percent, v_actor, v_email, 'trigger');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_bt  := CASE WHEN OLD.partner_id IS NOT NULL THEN 'partner'
                  WHEN OLD.collaborator_id IS NOT NULL THEN 'collaborator'
                  WHEN OLD.referrer_id IS NOT NULL THEN 'referrer'
                  WHEN OLD.service_provider_id IS NOT NULL THEN 'service_provider' END;
    v_bid := COALESCE(OLD.partner_id, OLD.collaborator_id, OLD.referrer_id, OLD.service_provider_id);
    INSERT INTO public.commission_audit_log(source_table, source_id, sale_id, payment_id, beneficiary_type, beneficiary_id, event, old_status, amount, percent, actor_id, actor_email, source)
    VALUES ('commissions', OLD.id, OLD.sale_id, OLD.payment_id, v_bt, v_bid, 'deleted', OLD.status::text, OLD.amount, OLD.percent, v_actor, v_email, 'trigger');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS commissions_audit_trg ON public.commissions;
CREATE TRIGGER commissions_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.trg_commissions_audit();

-- ==== Trigger: commission_splits audit ====
CREATE OR REPLACE FUNCTION public.trg_commission_splits_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := private.actor_email(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commission_audit_log(source_table, source_id, sale_id, beneficiary_type, beneficiary_id, event, new_status, amount, percent, actor_id, actor_email, source)
    VALUES ('commission_splits', NEW.id, NEW.sale_id, NEW.beneficiary_type::text, NEW.beneficiary_id, 'created', NEW.status::text, NEW.amount, NEW.percent, v_actor, v_email, 'trigger');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.status::text,'') IS DISTINCT FROM COALESCE(OLD.status::text,'') THEN
      INSERT INTO public.commission_audit_log(source_table, source_id, sale_id, beneficiary_type, beneficiary_id, event, old_status, new_status, amount, percent, actor_id, actor_email, source)
      VALUES ('commission_splits', NEW.id, NEW.sale_id, NEW.beneficiary_type::text, NEW.beneficiary_id,
              CASE WHEN NEW.status::text IN ('pago','paga') THEN 'paid' ELSE 'status_changed' END,
              OLD.status::text, NEW.status::text, NEW.amount, NEW.percent, v_actor, v_email, 'trigger');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.commission_audit_log(source_table, source_id, sale_id, beneficiary_type, beneficiary_id, event, old_status, amount, percent, actor_id, actor_email, source)
    VALUES ('commission_splits', OLD.id, OLD.sale_id, OLD.beneficiary_type::text, OLD.beneficiary_id, 'deleted', OLD.status::text, OLD.amount, OLD.percent, v_actor, v_email, 'trigger');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS commission_splits_audit_trg ON public.commission_splits;
CREATE TRIGGER commission_splits_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON public.commission_splits
FOR EACH ROW EXECUTE FUNCTION public.trg_commission_splits_audit();

-- Lock down helper
REVOKE EXECUTE ON FUNCTION private.actor_email(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.actor_email(uuid) TO service_role;
