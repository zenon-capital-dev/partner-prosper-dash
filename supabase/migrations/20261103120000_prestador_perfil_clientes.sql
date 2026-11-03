-- Perfil resumido dos clientes que o prestador atende (painel do prestador).
-- O prestador não tem SELECT em public.clients para clientes ligados só pela
-- demanda ou por documento compartilhado, por isso aparecia "Sem cliente".
-- Esta função devolve apenas os campos de Dados Pessoais, Principal Empresa e
-- Comercial, e só para clientes em que o prestador logado:
--   * atende ao menos uma demanda (responsável, secundário, vinculado ou convidado), ou
--   * recebeu algum documento compartilhado (document_shares, não expirado).
-- Não altera tabelas, políticas nem triggers.

CREATE OR REPLACE FUNCTION public.provider_client_profiles()
RETURNS TABLE (
  client_id uuid,
  full_name text,
  document text,
  birth_date date,
  email text,
  phone text,
  whatsapp text,
  company text,
  address_street text,
  address_number text,
  address_neighborhood text,
  city text,
  state text,
  address_zip_code text,
  source text,
  status text,
  created_at timestamptz,
  ltv numeric,
  demands jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT sp.id
    FROM public.service_providers sp
    WHERE sp.user_id = auth.uid()
  ),
  my_demands AS (
    SELECT cp.id, cp.client_id
    FROM public.client_products cp
    WHERE EXISTS (SELECT 1 FROM me)
      AND (
        private.is_delegated_provider(auth.uid(), cp.id)
        OR public.provider_has_demand_access(auth.uid(), cp.id)
      )
  ),
  shared_clients AS (
    SELECT DISTINCT d.client_id
    FROM public.document_shares ds
    JOIN public.documents d ON d.id = ds.document_id
    WHERE ds.provider_id IN (SELECT id FROM me)
      AND (ds.expires_at IS NULL OR ds.expires_at > now())
      AND d.client_id IS NOT NULL
  ),
  my_clients AS (
    SELECT client_id FROM my_demands
    UNION
    SELECT client_id FROM shared_clients
  )
  SELECT
    c.id,
    c.full_name,
    c.document,
    c.birth_date::date,
    c.email,
    c.phone,
    c.whatsapp,
    c.company,
    COALESCE(c.address_street, c.address),
    c.address_number,
    c.address_neighborhood,
    COALESCE(c.city, c.address_city),
    COALESCE(c.state, c.address_state),
    c.address_zip_code,
    c.source,
    c.status::text,
    c.created_at,
    (SELECT COALESCE(SUM(cp.value), 0) FROM public.client_products cp WHERE cp.client_id = c.id),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', cp.id,
               'name', COALESCE(p.name, cp.custom_product_name, 'Demanda'),
               'status', cp.status,
               'created_at', cp.created_at
             ) ORDER BY cp.created_at)
      FROM public.client_products cp
      LEFT JOIN public.products p ON p.id = cp.product_id
      WHERE cp.client_id = c.id
        AND cp.id IN (SELECT id FROM my_demands)
    ), '[]'::jsonb)
  FROM public.clients c
  WHERE c.id IN (SELECT client_id FROM my_clients)
  ORDER BY COALESCE(NULLIF(c.company, ''), c.full_name);
$$;

REVOKE ALL ON FUNCTION public.provider_client_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_client_profiles() TO authenticated;
