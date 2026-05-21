
-- 1) Onboarding config persistido no cliente
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS mandatory_steps jsonb NOT NULL DEFAULT '["confirm_data","upload_docs","sign_contracts","initial_payment"]'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_approval_required boolean NOT NULL DEFAULT false;

-- 2) Corrigir release de comissão quando payment muda
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
        status = 'pago',
        paid_at = COALESCE(paid_at, now()),
        approval_date = COALESCE(approval_date, now()),
        payment_date = COALESCE(payment_date, now()),
        updated_at = now()
    WHERE sale_id = NEW.sale_id
      AND (status::text NOT IN ('pago','paga','cancelada') OR workflow_status IN ('aguardando_confirmacao','pendente'));

    UPDATE public.commission_splits
    SET status = 'pago'::split_status,
        paid_at = COALESCE(paid_at, now()),
        updated_at = now()
    WHERE sale_id = NEW.sale_id
      AND status::text NOT IN ('pago','paga','cancelada');
  END IF;

  IF NEW.status::text <> 'pago' AND OLD.status::text = 'pago' THEN
    UPDATE public.commissions
    SET status = 'pendente',
        workflow_status = 'aguardando_confirmacao',
        paid_at = NULL,
        payment_date = NULL,
        updated_at = now()
    WHERE sale_id = NEW.sale_id;

    UPDATE public.commission_splits
    SET status = 'pendente'::split_status,
        paid_at = NULL,
        updated_at = now()
    WHERE sale_id = NEW.sale_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Onboarding completion respeita aprovação manual
CREATE OR REPLACE FUNCTION public.complete_client_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_manual boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT COALESCE(manual_approval_required, false) INTO v_manual
  FROM public.clients
  WHERE user_id = auth.uid();

  UPDATE public.clients
  SET
    onboarding_status = CASE WHEN v_manual THEN 'aguardando_aprovacao' ELSE 'completo' END,
    onboarding_progress = CASE WHEN v_manual THEN 90 ELSE 100 END,
    onboarding_completed_at = CASE WHEN v_manual THEN onboarding_completed_at ELSE COALESCE(onboarding_completed_at, now()) END,
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$function$;
