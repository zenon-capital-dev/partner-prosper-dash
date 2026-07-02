DROP TRIGGER IF EXISTS trg_sync_sale_financial_schedule ON public.sales;
CREATE TRIGGER trg_sync_sale_financial_schedule
AFTER UPDATE OF status
ON public.sales
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_sale_financial_schedule();

REVOKE ALL ON FUNCTION public.sync_sale_financial_schedule() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_sale() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_sale_splits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.maybe_release_commission() FROM PUBLIC, anon, authenticated;