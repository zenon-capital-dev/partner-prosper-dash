
-- RPC para o cliente concluir o próprio onboarding sem precisar abrir UPDATE direto na tabela clients
CREATE OR REPLACE FUNCTION public.complete_client_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  UPDATE public.clients
  SET
    onboarding_status = 'completo',
    onboarding_progress = 100,
    onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.complete_client_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_client_onboarding() TO authenticated;
