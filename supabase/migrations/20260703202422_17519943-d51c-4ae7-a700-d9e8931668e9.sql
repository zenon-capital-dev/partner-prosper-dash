
CREATE OR REPLACE FUNCTION private.storage_documents_can_read(_user_id uuid, _email text, _object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  WITH ctx AS (
    SELECT
      split_part(_object_name, '/', 1) AS first_part,
      split_part(_object_name, '/', 2) AS second_part,
      split_part(_object_name, '/', 3) AS third_part,
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
      SELECT 1 FROM ctx
      WHERE private.is_partner_for_client(_user_id, ctx.first_part::uuid)
    )
    OR EXISTS (
      SELECT 1 FROM ctx
      JOIN public.client_products cp2 ON cp2.client_id::text = ctx.first_part
      WHERE private.is_delegated_provider(_user_id, cp2.id)
    )
    OR EXISTS (
      SELECT 1 FROM ctx
      JOIN public.client_providers cpv ON cpv.client_id::text = ctx.first_part
      JOIN public.service_providers sp ON sp.id = cpv.service_provider_id
      WHERE sp.user_id = _user_id OR lower(sp.email) = lower(_email)
    )
    -- Prestador autorizado em pasta específica: path = "<clientId>/folder/<folderId>/..."
    OR EXISTS (
      SELECT 1
      FROM ctx
      JOIN public.client_document_folder_providers p ON p.folder_id::text = ctx.third_part
      JOIN public.service_providers sp ON sp.id = p.provider_id
      WHERE ctx.second_part = 'folder'
        AND (sp.user_id = _user_id OR lower(sp.email) = lower(_email))
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
