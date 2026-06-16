-- Tornar helpers de RLS STABLE + PARALLEL SAFE para que o Postgres possa
-- cachear os resultados em uma única execução da query (InitPlan) em vez de
-- reavaliar por linha. Sem isto, listar clientes/parceiros/etc faz N calls
-- de auth.uid() + user_roles por linha.

ALTER FUNCTION public.is_admin() STABLE PARALLEL SAFE;
ALTER FUNCTION public.is_admin(uuid) STABLE PARALLEL SAFE;
ALTER FUNCTION public.has_role(uuid, app_role) STABLE PARALLEL SAFE;
ALTER FUNCTION public.is_delegated_provider(uuid, uuid) STABLE PARALLEL SAFE;

ALTER FUNCTION private.is_admin() STABLE PARALLEL SAFE;
ALTER FUNCTION private.is_admin(uuid) STABLE PARALLEL SAFE;
ALTER FUNCTION private.has_role(uuid, app_role) STABLE PARALLEL SAFE;
ALTER FUNCTION private.is_partner_for_client(uuid, uuid) STABLE PARALLEL SAFE;
ALTER FUNCTION private.is_referrer_for_client(uuid, uuid) STABLE PARALLEL SAFE;
ALTER FUNCTION private.is_delegated_provider(uuid, uuid) STABLE PARALLEL SAFE;
ALTER FUNCTION private.is_collaborator_for_client(uuid, uuid) STABLE PARALLEL SAFE;
ALTER FUNCTION private.is_collaborator_for_client_product(uuid, uuid) STABLE PARALLEL SAFE;
ALTER FUNCTION private.is_secondary_provider_for_client_product(uuid, uuid) STABLE PARALLEL SAFE;
