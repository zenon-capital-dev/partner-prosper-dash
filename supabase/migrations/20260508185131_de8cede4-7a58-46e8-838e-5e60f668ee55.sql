-- View for performance by product
CREATE OR REPLACE VIEW public.view_performance_by_product AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    COUNT(s.id) as total_sales,
    SUM(s.amount) as gross_revenue,
    SUM(COALESCE((SELECT SUM(amount) FROM public.commission_splits WHERE sale_id = s.id), 0)) as total_commissions,
    (SUM(s.amount) - SUM(COALESCE((SELECT SUM(amount) FROM public.commission_splits WHERE sale_id = s.id), 0))) as net_revenue
FROM public.products p
LEFT JOIN public.sales s ON s.product_id = p.id AND s.status = 'concluida'
GROUP BY p.id, p.name;

-- View for performance by lead source
CREATE OR REPLACE VIEW public.view_performance_by_source AS
SELECT 
    l.source,
    COUNT(l.id) as total_leads,
    COUNT(s.id) as converted_sales,
    SUM(COALESCE(s.amount, 0)) as total_revenue
FROM public.leads l
LEFT JOIN public.sales s ON s.client_id = l.converted_to_client_id AND s.status = 'concluida'
GROUP BY l.source;

-- Update commission_splits status when commission is updated (to sync)
CREATE OR REPLACE FUNCTION public.sync_commission_split_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- If it's a direct partner commission match
    UPDATE public.commission_splits 
    SET status = NEW.status::text::split_status, 
        paid_at = NEW.paid_at,
        updated_at = now()
    WHERE sale_id = NEW.sale_id 
      AND beneficiary_type = 'partner' 
      AND beneficiary_id = NEW.partner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_commission_split_status ON public.commissions;
CREATE TRIGGER tr_sync_commission_split_status
AFTER UPDATE OF status ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION public.sync_commission_split_status();
