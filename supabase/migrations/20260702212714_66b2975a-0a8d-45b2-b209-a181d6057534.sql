
REVOKE EXECUTE ON FUNCTION public.trg_payments_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_commissions_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_commission_splits_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_payments_audit() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_commissions_audit() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_commission_splits_audit() TO service_role;
