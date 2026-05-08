DROP TRIGGER IF EXISTS on_sale_created ON public.sales;
DROP TRIGGER IF EXISTS trg_generate_commission_splits ON public.sales;
DROP TRIGGER IF EXISTS trg_handle_new_sale ON public.sales;
DROP TRIGGER IF EXISTS trg_sales_generate_splits ON public.sales;

-- Garantir que o handle_sale_splits está ativo
DROP TRIGGER IF EXISTS tr_handle_sale_splits ON public.sales;
CREATE TRIGGER tr_handle_sale_splits
AFTER INSERT OR UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.handle_sale_splits();