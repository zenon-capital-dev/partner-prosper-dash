CREATE OR REPLACE FUNCTION public.notify_on_contract()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'assinado') THEN
    PERFORM public.notify_admins(
      CASE WHEN TG_OP='INSERT' THEN 'Novo contrato' ELSE 'Contrato assinado' END,
      COALESCE(NEW.name,'—'),
      '/contratos',
      'contract'
    );
  END IF;
  RETURN NEW;
END; $function$