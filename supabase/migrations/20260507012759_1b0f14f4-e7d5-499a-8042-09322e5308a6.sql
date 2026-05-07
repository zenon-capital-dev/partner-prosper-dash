
-- Trigger: gerar comissão automaticamente ao criar venda com parceiro
DROP TRIGGER IF EXISTS trg_handle_new_sale ON public.sales;
CREATE TRIGGER trg_handle_new_sale
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.handle_new_sale();

-- Trigger: gerar splits de comissão (parceiro/indicador/colaborador) ao criar venda
DROP TRIGGER IF EXISTS trg_generate_commission_splits ON public.sales;
CREATE TRIGGER trg_generate_commission_splits
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.generate_commission_splits();

-- updated_at automáticos nas tabelas-chave da Etapa 3
DROP TRIGGER IF EXISTS trg_partners_updated_at ON public.partners;
CREATE TRIGGER trg_partners_updated_at BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_referrers_updated_at ON public.referrers;
CREATE TRIGGER trg_referrers_updated_at BEFORE UPDATE ON public.referrers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_commissions_updated_at ON public.commissions;
CREATE TRIGGER trg_commissions_updated_at BEFORE UPDATE ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_commission_splits_updated_at ON public.commission_splits;
CREATE TRIGGER trg_commission_splits_updated_at BEFORE UPDATE ON public.commission_splits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_sales_updated_at ON public.sales;
CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
