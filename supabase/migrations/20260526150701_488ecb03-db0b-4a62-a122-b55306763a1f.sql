CREATE OR REPLACE FUNCTION public.admin_delete_product_cascade(_product_id uuid, _force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sales_count int;
  v_active_cp_count int;
  v_sale_ids uuid[];
  v_cp_ids uuid[];
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT count(*) INTO v_sales_count FROM public.sales WHERE product_id = _product_id;
  SELECT count(*) INTO v_active_cp_count FROM public.client_products
    WHERE product_id = _product_id AND COALESCE(status,'') NOT IN ('concluido','concluida','cancelado','cancelada');

  IF NOT _force THEN
    IF v_sales_count > 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'has_sales', 'sales', v_sales_count,
        'message', 'Este produto possui ' || v_sales_count || ' venda(s) registrada(s). Use exclusão forçada para remover tudo (vendas, comissões e demandas).');
    END IF;
    IF v_active_cp_count > 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'has_active_demands', 'demands', v_active_cp_count,
        'message', 'Existem ' || v_active_cp_count || ' demanda(s) ativa(s). Use exclusão forçada para remover tudo.');
    END IF;
  END IF;

  SELECT array_agg(id) INTO v_sale_ids FROM public.sales WHERE product_id = _product_id;
  SELECT array_agg(id) INTO v_cp_ids FROM public.client_products WHERE product_id = _product_id;

  IF v_sale_ids IS NOT NULL THEN
    DELETE FROM public.commission_splits WHERE sale_id = ANY(v_sale_ids);
    DELETE FROM public.commissions WHERE sale_id = ANY(v_sale_ids);
    DELETE FROM public.payments WHERE sale_id = ANY(v_sale_ids);
  END IF;

  IF v_cp_ids IS NOT NULL THEN
    DELETE FROM public.client_product_steps WHERE client_product_id = ANY(v_cp_ids);
    DELETE FROM public.tasks WHERE client_product_id = ANY(v_cp_ids);
    DELETE FROM public.documents WHERE client_product_id = ANY(v_cp_ids);
    BEGIN
      DELETE FROM public.client_product_status_reports WHERE client_product_id = ANY(v_cp_ids);
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  DELETE FROM public.client_products WHERE product_id = _product_id;
  DELETE FROM public.sales WHERE product_id = _product_id;
  DELETE FROM public.product_steps WHERE product_id = _product_id;
  DELETE FROM public.product_required_documents WHERE product_id = _product_id;
  DELETE FROM public.service_provider_products WHERE product_id = _product_id;
  DELETE FROM public.collaborator_products WHERE product_id = _product_id;
  DELETE FROM public.partner_products WHERE product_id = _product_id;
  DELETE FROM public.products WHERE id = _product_id;

  RETURN jsonb_build_object('ok', true, 'message',
    CASE WHEN _force THEN 'Produto e todos os vínculos excluídos.' ELSE 'Produto excluído com sucesso.' END);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_delete_product_cascade(uuid, boolean) TO authenticated;