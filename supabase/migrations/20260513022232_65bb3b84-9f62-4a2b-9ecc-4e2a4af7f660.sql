
-- Remove duplicate trigger
DROP TRIGGER IF EXISTS tr_handle_sale_splits ON public.sales;

-- Replace function: drop bogus 'company' insert, add collaborator split
CREATE OR REPLACE FUNCTION public.handle_sale_splits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_amount      numeric(12,2);
    v_referrer_amount     numeric(12,2);
    v_collab_amount       numeric(12,2);
BEGIN
    v_partner_amount  := (NEW.amount * COALESCE(NEW.commission_percent, 0))     / 100;
    v_referrer_amount := (NEW.amount * COALESCE(NEW.referrer_percent, 0))       / 100;
    v_collab_amount   := (NEW.amount * COALESCE(NEW.collaborator_percent, 0))   / 100;

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

    RETURN NEW;
END;
$$;
