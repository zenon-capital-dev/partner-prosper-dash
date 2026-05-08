-- Ensure the function generate_commission_splits handles updates by deleting old splits first
CREATE OR REPLACE FUNCTION public.handle_sale_splits()
RETURNS TRIGGER AS $$
BEGIN
  -- Clear existing splits for this sale to avoid duplicates on update
  DELETE FROM public.commission_splits WHERE sale_id = NEW.id;

  -- Create split for Partner
  IF NEW.partner_id IS NOT NULL AND COALESCE(NEW.commission_percent, 0) > 0 THEN
    INSERT INTO public.commission_splits(sale_id, beneficiary_type, beneficiary_id, percent, amount)
    VALUES (NEW.id, 'partner', NEW.partner_id, NEW.commission_percent,
            ROUND(NEW.amount * NEW.commission_percent / 100, 2));
  END IF;

  -- Create split for Referrer (Indicador)
  IF NEW.referrer_id IS NOT NULL AND COALESCE(NEW.referrer_percent, 0) > 0 THEN
    INSERT INTO public.commission_splits(sale_id, beneficiary_type, beneficiary_id, percent, amount)
    VALUES (NEW.id, 'referrer', NEW.referrer_id, NEW.referrer_percent,
            ROUND(NEW.amount * NEW.referrer_percent / 100, 2));
  END IF;

  -- Create split for Collaborator (Consultor/Vendedor)
  IF NEW.collaborator_id IS NOT NULL AND COALESCE(NEW.collaborator_percent, 0) > 0 THEN
    INSERT INTO public.commission_splits(sale_id, beneficiary_type, beneficiary_id, percent, amount)
    VALUES (NEW.id, 'collaborator', NEW.collaborator_id, NEW.collaborator_percent,
            ROUND(NEW.amount * NEW.collaborator_percent / 100, 2));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on sales table
DROP TRIGGER IF EXISTS tr_handle_sale_splits ON public.sales;
CREATE TRIGGER tr_handle_sale_splits
AFTER INSERT OR UPDATE OF amount, partner_id, commission_percent, referrer_id, referrer_percent, collaborator_id, collaborator_percent
ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_sale_splits();
