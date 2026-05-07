
REVOKE ALL ON FUNCTION public.notify_admins(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_sale() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_lead() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_commission_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_contract() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_task_assign() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_document() FROM PUBLIC, anon, authenticated;
