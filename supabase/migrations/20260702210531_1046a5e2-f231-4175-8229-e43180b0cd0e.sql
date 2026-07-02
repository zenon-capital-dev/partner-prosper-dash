
-- 1. Add payment_id link on commissions
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_payment_id ON public.commissions(payment_id);

-- 2. Function: generate commissions for a paid payment
CREATE OR REPLACE FUNCTION public.sync_commissions_for_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  s RECORD;
  share numeric;
  base numeric;
  due date;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND OR p.status <> 'pago' OR p.sale_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO s FROM public.sales WHERE id = p.sale_id;
  IF NOT FOUND OR COALESCE(s.amount,0) <= 0 THEN
    RETURN;
  END IF;

  -- Wipe pending rows for this payment so we can regenerate cleanly.
  -- Do NOT touch already-paid commissions.
  DELETE FROM public.commissions
   WHERE payment_id = p_payment_id AND status = 'pendente';

  share := COALESCE(p.amount, 0) / s.amount;
  due   := COALESCE(p.paid_at::date, p.due_date, CURRENT_DATE);

  -- Partner
  IF s.partner_id IS NOT NULL AND COALESCE(s.commission_percent,0) > 0 THEN
    base := round(s.amount * (s.commission_percent / 100.0) * share, 2);
    IF base > 0 THEN
      INSERT INTO public.commissions
        (sale_id, client_id, product_id, partner_id, sale_value, percent, amount,
         status, expected_date, payment_id, notes)
      VALUES
        (s.id, s.client_id, s.product_id, s.partner_id, s.amount, s.commission_percent, base,
         'pendente', due, p_payment_id,
         'Gerado automaticamente da parcela ' || COALESCE(p.installment_number::text,'?'));
    END IF;
  END IF;

  -- Referrer
  IF s.referrer_id IS NOT NULL AND COALESCE(s.referrer_percent,0) > 0 THEN
    base := round(s.amount * (s.referrer_percent / 100.0) * share, 2);
    IF base > 0 THEN
      INSERT INTO public.commissions
        (sale_id, client_id, product_id, referrer_id, sale_value, percent, amount,
         status, expected_date, payment_id, notes)
      VALUES
        (s.id, s.client_id, s.product_id, s.referrer_id, s.amount, s.referrer_percent, base,
         'pendente', due, p_payment_id,
         'Indicação — parcela ' || COALESCE(p.installment_number::text,'?'));
    END IF;
  END IF;

  -- Collaborator
  IF s.collaborator_id IS NOT NULL AND COALESCE(s.collaborator_percent,0) > 0 THEN
    base := round(s.amount * (s.collaborator_percent / 100.0) * share, 2);
    IF base > 0 THEN
      INSERT INTO public.commissions
        (sale_id, client_id, product_id, collaborator_id, sale_value, percent, amount,
         status, expected_date, payment_id, notes)
      VALUES
        (s.id, s.client_id, s.product_id, s.collaborator_id, s.amount, s.collaborator_percent, base,
         'pendente', due, p_payment_id,
         'Colaborador — parcela ' || COALESCE(p.installment_number::text,'?'));
    END IF;
  END IF;

  -- Service provider (fixed cost proportional to installment)
  IF s.service_provider_id IS NOT NULL AND COALESCE(s.provider_cost,0) > 0 THEN
    base := round(s.provider_cost * share, 2);
    IF base > 0 THEN
      INSERT INTO public.commissions
        (sale_id, client_id, product_id, service_provider_id, sale_value, percent, amount,
         status, expected_date, payment_id, notes)
      VALUES
        (s.id, s.client_id, s.product_id, s.service_provider_id, s.amount, 0, base,
         'pendente', due, p_payment_id,
         'Prestador — parcela ' || COALESCE(p.installment_number::text,'?'));
    END IF;
  END IF;
END;
$$;

-- 3. Trigger function on payments
CREATE OR REPLACE FUNCTION public.trg_payments_sync_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pago' THEN
      PERFORM public.sync_commissions_for_payment(NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
      PERFORM public.sync_commissions_for_payment(NEW.id);
    ELSIF OLD.status = 'pago' AND NEW.status <> 'pago' THEN
      DELETE FROM public.commissions
       WHERE payment_id = NEW.id AND status = 'pendente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_commissions ON public.payments;
CREATE TRIGGER payments_sync_commissions
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_payments_sync_commissions();
