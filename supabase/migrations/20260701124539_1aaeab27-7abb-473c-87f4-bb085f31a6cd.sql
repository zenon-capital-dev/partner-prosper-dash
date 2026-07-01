CREATE OR REPLACE FUNCTION private.storage_documents_can_read(_user_id uuid, _email text, _object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ctx AS (
    SELECT
      private.storage_partner_id_for_user(_user_id, _email) AS partner_id,
      private.storage_provider_id_for_user(_user_id, _email) AS provider_id,
      private.storage_referrer_id_for_user(_user_id, _email) AS referrer_id
  )
  SELECT
    private.storage_is_internal(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.user_id = _user_id
        AND split_part(_object_name, '/', 1) = c.id::text
    )
    OR EXISTS (
      SELECT 1
      FROM public.documents d, ctx
      WHERE d.file_path = _object_name
        AND (
          (d.partner_id IS NOT NULL AND d.partner_id = ctx.partner_id)
          OR (d.provider_id IS NOT NULL AND d.provider_id = ctx.provider_id)
          OR (d.collaborator_id IS NOT NULL AND d.collaborator_id = _user_id)
          OR (d.client_id IS NOT NULL AND (
            EXISTS (SELECT 1 FROM public.clients c WHERE c.id = d.client_id AND c.user_id = _user_id)
            OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = d.client_id AND c.partner_id = ctx.partner_id)
            OR EXISTS (SELECT 1 FROM public.client_partners cp WHERE cp.client_id = d.client_id AND cp.partner_id = ctx.partner_id)
            OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = d.client_id AND c.referrer_id = ctx.referrer_id)
            OR EXISTS (SELECT 1 FROM public.client_referrers cr WHERE cr.client_id = d.client_id AND cr.referrer_id = ctx.referrer_id)
            OR EXISTS (SELECT 1 FROM public.client_providers cpr WHERE cpr.client_id = d.client_id AND cpr.service_provider_id = ctx.provider_id)
            OR EXISTS (SELECT 1 FROM public.client_collaborators cc WHERE cc.client_id = d.client_id AND cc.collaborator_id = _user_id)
          ))
          OR (d.client_product_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM public.client_products cp
            WHERE cp.id = d.client_product_id
              AND (
                private.is_partner_for_client(_user_id, cp.client_id)
                OR private.is_referrer_for_client(_user_id, cp.client_id)
                OR private.is_delegated_provider(_user_id, cp.id)
                OR private.is_collaborator_for_client_product(_user_id, cp.id)
              )
          ))
          OR (d.folder_id IS NOT NULL AND EXISTS (
            SELECT 1
            FROM public.client_document_folder_providers fp
            JOIN public.service_providers sp ON sp.id = fp.provider_id
            WHERE fp.folder_id = d.folder_id AND sp.user_id = _user_id
          ))
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.client_document_requests cdr
      JOIN public.client_products cp ON cp.id = cdr.client_product_id
      WHERE cdr.file_url = _object_name
        AND (
          private.is_partner_for_client(_user_id, cp.client_id)
          OR private.is_delegated_provider(_user_id, cp.id)
          OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = cp.client_id AND c.user_id = _user_id)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.demand_deliveries dd
      JOIN public.client_products cp ON cp.id = dd.client_product_id
      WHERE dd.file_url = _object_name
        AND (
          private.is_partner_for_client(_user_id, cp.client_id)
          OR private.is_referrer_for_client(_user_id, cp.client_id)
          OR private.is_delegated_provider(_user_id, cp.id)
          OR private.is_collaborator_for_client_product(_user_id, cp.id)
          OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = cp.client_id AND c.user_id = _user_id)
        )
    );
$function$;