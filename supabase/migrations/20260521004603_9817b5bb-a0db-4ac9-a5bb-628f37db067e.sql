CREATE OR REPLACE FUNCTION public.admin_delete_client_cascade(_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_ids uuid[];
  v_cp_ids uuid[];
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT array_agg(id) INTO v_sale_ids FROM public.sales WHERE client_id = _client_id;
  SELECT array_agg(id) INTO v_cp_ids FROM public.client_products WHERE client_id = _client_id;

  -- Children of client_products
  IF v_cp_ids IS NOT NULL THEN
    DELETE FROM public.client_product_steps WHERE client_product_id = ANY(v_cp_ids);
    DELETE FROM public.tasks WHERE client_product_id = ANY(v_cp_ids);
    DELETE FROM public.documents WHERE client_product_id = ANY(v_cp_ids);
  END IF;

  -- Children of sales
  IF v_sale_ids IS NOT NULL THEN
    DELETE FROM public.commission_splits WHERE sale_id = ANY(v_sale_ids);
    DELETE FROM public.commissions WHERE sale_id = ANY(v_sale_ids);
    DELETE FROM public.payments WHERE sale_id = ANY(v_sale_ids);
  END IF;

  -- Direct client refs
  DELETE FROM public.tasks WHERE client_id = _client_id;
  DELETE FROM public.documents WHERE client_id = _client_id;
  DELETE FROM public.commissions WHERE client_id = _client_id;
  DELETE FROM public.payments WHERE client_id = _client_id;
  DELETE FROM public.proposals WHERE client_id = _client_id;
  DELETE FROM public.contracts WHERE client_id = _client_id;
  DELETE FROM public.client_products WHERE client_id = _client_id;
  DELETE FROM public.sales WHERE client_id = _client_id;
  DELETE FROM public.companies WHERE client_id = _client_id;

  DELETE FROM public.clients WHERE id = _client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_client_cascade(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_client_cascade(uuid) TO authenticated;