
-- 1. Relax commission_splits schema so it can be tied to a payment (not just a sale)
ALTER TABLE public.commission_splits ALTER COLUMN sale_id DROP NOT NULL;
ALTER TABLE public.commission_splits
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_product_id uuid REFERENCES public.client_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commission_splits_payment_id ON public.commission_splits(payment_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_client_id ON public.commission_splits(client_id);

ALTER TABLE public.commission_splits DROP CONSTRAINT IF EXISTS commission_splits_anchor_chk;
ALTER TABLE public.commission_splits
  ADD CONSTRAINT commission_splits_anchor_chk
  CHECK (sale_id IS NOT NULL OR payment_id IS NOT NULL) NOT VALID;

-- 2. Function: sync splits directly from a payment (fallback path when there's no sale)
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
      FROM public.client_products WHERE id = p.client_product_id;
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

-- 3. Trigger on payments
CREATE OR REPLACE FUNCTION public.trg_payments_sync_splits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sale_id IS NOT NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.sync_splits_for_payment(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.client_product_id IS DISTINCT FROM OLD.client_product_id
       OR NEW.partner_id IS DISTINCT FROM OLD.partner_id
       OR NEW.referrer_id IS DISTINCT FROM OLD.referrer_id
       OR NEW.collaborator_id IS DISTINCT FROM OLD.collaborator_id THEN
      PERFORM public.sync_splits_for_payment(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_payments_sync_splits ON public.payments;
CREATE TRIGGER trg_payments_sync_splits
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_payments_sync_splits();

-- 4. Backfill existing sale-less payments
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.payments WHERE sale_id IS NULL LOOP
    PERFORM public.sync_splits_for_payment(r.id);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_splits_for_payment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_payments_sync_splits() FROM PUBLIC, anon;
