
CREATE OR REPLACE FUNCTION public.admin_delete_product_cascade(_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sales_count int;
  v_active_cp_count int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT count(*) INTO v_sales_count FROM public.sales WHERE product_id = _product_id;
  SELECT count(*) INTO v_active_cp_count FROM public.client_products
    WHERE product_id = _product_id AND COALESCE(status,'') NOT IN ('concluido','concluida','cancelado','cancelada');

  IF v_sales_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'has_sales', 'sales', v_sales_count,
      'message', 'Este produto possui ' || v_sales_count || ' venda(s) registrada(s). Por integridade fiscal, apenas desative-o.');
  END IF;

  IF v_active_cp_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'has_active_demands', 'demands', v_active_cp_count,
      'message', 'Existem ' || v_active_cp_count || ' demanda(s) ativa(s) usando este produto. Conclua ou cancele antes.');
  END IF;

  DELETE FROM public.client_product_steps WHERE client_product_id IN (SELECT id FROM public.client_products WHERE product_id = _product_id);
  DELETE FROM public.documents WHERE client_product_id IN (SELECT id FROM public.client_products WHERE product_id = _product_id);
  DELETE FROM public.tasks WHERE client_product_id IN (SELECT id FROM public.client_products WHERE product_id = _product_id);
  DELETE FROM public.client_products WHERE product_id = _product_id;
  DELETE FROM public.product_steps WHERE product_id = _product_id;
  DELETE FROM public.product_required_documents WHERE product_id = _product_id;
  DELETE FROM public.service_provider_products WHERE product_id = _product_id;
  DELETE FROM public.collaborator_products WHERE product_id = _product_id;
  DELETE FROM public.partner_products WHERE product_id = _product_id;
  DELETE FROM public.products WHERE id = _product_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Produto excluído com sucesso.');
END;
$$;
