
-- 1) Storage insert em `documents` também permite o prestador PRIMÁRIO da demanda
CREATE OR REPLACE FUNCTION private.storage_documents_can_insert(_user_id uuid, _email text, _object_name text)
RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH ctx AS (
    SELECT
      split_part(_object_name, '/', 1) AS first_part,
      split_part(_object_name, '/', 2) AS second_part,
      private.storage_partner_id_for_user(_user_id, _email) AS partner_id,
      private.storage_provider_id_for_user(_user_id, _email) AS provider_id
  )
  SELECT
    private.storage_is_internal(_user_id)
    OR EXISTS (SELECT 1 FROM ctx WHERE first_part = 'partners' AND second_part = partner_id::text)
    OR EXISTS (SELECT 1 FROM ctx JOIN public.clients c ON c.id::text = ctx.first_part WHERE c.user_id = _user_id)
    OR EXISTS (
      SELECT 1
      FROM ctx
      JOIN public.client_products cp ON cp.id::text = ctx.first_part
      WHERE public.user_involved_in_demand(_user_id, cp.id)
    );
$$;

-- 2) Também amplia leitura via path <client_product_id>/... para envolvidos na demanda
CREATE OR REPLACE FUNCTION private.storage_documents_can_read(_user_id uuid, _email text, _object_name text)
RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH ctx AS (
    SELECT
      split_part(_object_name, '/', 1) AS first_part,
      private.storage_partner_id_for_user(_user_id, _email) AS partner_id,
      private.storage_provider_id_for_user(_user_id, _email) AS provider_id,
      private.storage_referrer_id_for_user(_user_id, _email) AS referrer_id
  )
  SELECT
    private.storage_is_internal(_user_id)
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = _user_id AND split_part(_object_name, '/', 1) = c.id::text)
    OR EXISTS (
      SELECT 1 FROM ctx JOIN public.client_products cp ON cp.id::text = ctx.first_part
      WHERE public.user_involved_in_demand(_user_id, cp.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.documents d, ctx
      WHERE d.file_path = _object_name
        AND (
          (d.partner_id IS NOT NULL AND d.partner_id = ctx.partner_id)
          OR (d.provider_id IS NOT NULL AND d.provider_id = ctx.provider_id)
          OR (d.collaborator_id IS NOT NULL AND d.collaborator_id = _user_id)
          OR (d.client_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = d.client_id AND c.user_id = _user_id))
          OR (d.client_product_id IS NOT NULL AND public.user_involved_in_demand(_user_id, d.client_product_id))
        )
    );
$$;

-- 3) Consolida INSERT em demand_comments cobrindo TODOS os papéis
DROP POLICY IF EXISTS "Authenticated can insert demand comments" ON public.demand_comments;
CREATE POLICY "Authenticated can insert demand comments"
ON public.demand_comments FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_admin(auth.uid())
    OR public.user_involved_in_demand(auth.uid(), client_product_id)
  )
);

-- 4) Amplia SELECT para prestador primário / envolvido também
DROP POLICY IF EXISTS "Providers can see allowed demand comments" ON public.demand_comments;
CREATE POLICY "Providers can see allowed demand comments"
ON public.demand_comments FOR SELECT TO authenticated
USING (
  visibility = ANY (ARRAY['provider'::comment_visibility, 'client'::comment_visibility, 'system'::comment_visibility])
  AND public.user_involved_in_demand(auth.uid(), client_product_id)
);
