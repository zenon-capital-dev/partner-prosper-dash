CREATE OR REPLACE FUNCTION public.maybe_release_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status::text = 'pago' AND (OLD.status IS NULL OR OLD.status::text <> 'pago') THEN
    UPDATE public.commissions
    SET workflow_status = 'liberada',
        updated_at = now()
    WHERE sale_id = NEW.sale_id
      AND workflow_status IN ('aguardando_confirmacao', 'pendente');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_payments_release_commission ON public.payments;
CREATE TRIGGER trg_payments_release_commission
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.maybe_release_commission();