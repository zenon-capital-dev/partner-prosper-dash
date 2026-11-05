-- Confere se os objetos de cada migration existem no banco.
-- Somente leitura: não altera nada. Pode rodar quantas vezes quiser.
-- Limite: confirma que o objeto existe, não que a função está na versão mais recente.
WITH esperado(migration, tipo, objeto) AS (VALUES
  ('20261024160000','funcao','private.provider_has_document_share'),
  ('20261024160000','funcao','private.is_provider_user'),

  ('20261102120000','funcao','public.enforce_demand_link_on_documents'),

  ('20261103120000','funcao','public.provider_client_profiles'),

  ('20261103180000','funcao','public.provider_client_dossier'),

  ('20261103200000','funcao','public.my_commission_statement'),

  ('20261103210000','tabela','public.client_product_financials'),
  ('20261103210000','funcao','private.divert_client_product_money'),
  ('20261103210000','funcao','public.sync_splits_for_payment'),
  ('20261103210000','funcao','public.sync_sale_to_client_product'),
  ('20261103210000','gatilho','public.client_products:zz_divert_client_product_money'),
  ('20261103210000','visao','public.view_client_financial_summary'),

  ('20261103220000','tabela','public.deduction_types'),
  ('20261103220000','tabela','public.product_deduction_templates'),
  ('20261103220000','tabela','public.sale_deductions'),
  ('20261103220000','coluna','public.sales.deduction_model'),
  ('20261103220000','funcao','private.sale_deduction_totals'),
  ('20261103220000','funcao','private.sales_apply_deductions'),
  ('20261103220000','funcao','private.sale_deductions_sync_sale'),
  ('20261103220000','gatilho','public.sales:trg_sales_apply_deductions'),
  ('20261103220000','gatilho','public.sale_deductions:trg_sale_deductions_sync_ins'),
  ('20261103220000','gatilho','public.sale_deductions:trg_sale_deductions_sync_upd'),
  ('20261103220000','gatilho','public.sale_deductions:trg_sale_deductions_sync_del'),

  ('20261103230000','tabela','public.financial_visibility'),
  ('20261103230000','tabela','public.sale_visibility_overrides'),
  ('20261103230000','funcao','private.my_beneficiaries'),
  ('20261103230000','funcao','private.effective_visibility'),
  ('20261103230000','funcao','public.my_sale_disclosure'),

  ('20261103240000','coluna','public.commission_splits.released_amount'),
  ('20261103240000','coluna','public.commissions.released_amount'),
  ('20261103240000','coluna','public.expenses.sale_id'),
  ('20261103240000','coluna','public.expenses.sale_deduction_id'),
  ('20261103240000','coluna','public.expenses.payment_id'),
  ('20261103240000','coluna','public.expenses.auto_provision'),
  ('20261103240000','funcao','private.sale_received'),
  ('20261103240000','funcao','private.recompute_sale_release'),
  ('20261103240000','funcao','public.maybe_release_commission'),
  ('20261103240000','funcao','private.sales_recompute_release'),
  ('20261103240000','funcao','private.regenerate_sale_provisions'),
  ('20261103240000','funcao','private.provisions_from_changed_rows'),
  ('20261103240000','funcao','private.sales_regenerate_provisions'),
  ('20261103240000','gatilho','public.payments:trg_payments_release_commission'),
  ('20261103240000','gatilho','public.sales:on_sale_zz_recompute_release'),
  ('20261103240000','gatilho','public.payments:trg_payments_provisions_ins'),
  ('20261103240000','gatilho','public.payments:trg_payments_provisions_upd'),
  ('20261103240000','gatilho','public.payments:trg_payments_provisions_del'),
  ('20261103240000','gatilho','public.sale_deductions:trg_sale_deductions_provisions_ins'),
  ('20261103240000','gatilho','public.sale_deductions:trg_sale_deductions_provisions_upd'),
  ('20261103240000','gatilho','public.sale_deductions:trg_sale_deductions_provisions_del'),
  ('20261103240000','gatilho','public.sales:trg_sales_regenerate_provisions'),

  ('20261103250000','coluna','public.sales.deduction_review_pending'),
  ('20261103250000','coluna','public.sales.cascata_since'),
  ('20261103250000','funcao','private.paid_split_total'),
  ('20261103250000','funcao','private.sales_mark_conversion'),
  ('20261103250000','gatilho','public.sales:trg_sales_mark_conversion'),
  ('20261103250000','gatilho','public.sales:on_sale_created'),
  ('20261103250000','gatilho','public.sales:on_sale_created_splits'),
  ('20261103250000','visao','public.v_commission_overpayments'),

  ('20261103260000','coluna','public.sales.installments_count'),
  ('20261103260000','coluna','public.sales.first_due_date'),
  ('20261103260000','restricao','public.sales:sales_installments_count_check'),
  ('20261103260000','funcao','private.generate_sale_payments'),
  ('20261103260000','funcao','public.sync_sale_financial_schedule'),
  ('20261103260000','funcao','public.regenerate_sale_payments'),
  ('20261103260000','funcao','private.goal_actuals'),
  ('20261103260000','funcao','public.sales_goal_actuals'),
  ('20261103260000','funcao','public.recompute_sales_goals_for_month'),
  ('20261103260000','funcao','public.trg_recompute_goals_current_month'),
  ('20261103260000','gatilho','public.sales:trg_sync_sale_financial_schedule'),
  ('20261103260000','gatilho','public.payments:trg_goals_on_payment'),

  ('20261104120000','tabela','public.cash_accounts'),
  ('20261104120000','tabela','public.cash_permissions'),
  ('20261104120000','tabela','public.cash_opening_balances'),
  ('20261104120000','tabela','public.cash_other_income'),
  ('20261104120000','tabela','public.cash_settlements'),
  ('20261104120000','tabela','public.cash_sale_adjustments'),
  ('20261104120000','funcao','private.can_access_cash'),
  ('20261104120000','funcao','private.can_operate_cash'),
  ('20261104120000','funcao','private.cash_settlements_append_only'),
  ('20261104120000','funcao','private.cash_today'),
  ('20261104120000','funcao','private.cash_default_account'),
  ('20261104120000','funcao','private.cash_net_settled'),
  ('20261104120000','funcao','private.cash_mirror_source'),
  ('20261104120000','funcao','private.cash_reverse_amount'),
  ('20261104120000','funcao','private.cash_split_no_auto_paid'),
  ('20261104120000','funcao','private.cash_guard_source'),
  ('20261104120000','funcao','private.cash_capture_payment'),
  ('20261104120000','funcao','private.cash_capture_expense'),
  ('20261104120000','funcao','private.cash_capture_split'),
  ('20261104120000','funcao','private.cash_capture_commission'),
  ('20261104120000','funcao','private.cash_obligations'),
  ('20261104120000','funcao','private.cash_movement'),
  ('20261104120000','funcao','public.cash_can_access'),
  ('20261104120000','funcao','public.cash_settle'),
  ('20261104120000','funcao','public.cash_receive_for_sale'),
  ('20261104120000','funcao','public.cash_reverse'),
  ('20261104120000','funcao','public.cash_reverse_source'),
  ('20261104120000','funcao','public.cash_refund_payment'),
  ('20261104120000','funcao','public.cash_convert_monthly_sale'),
  ('20261104120000','funcao','public.cash_confirm_historic'),
  ('20261104120000','funcao','public.cash_create_entry'),
  ('20261104120000','funcao','public.cash_cancel_income'),
  ('20261104120000','funcao','public.cash_set_opening_balance'),
  ('20261104120000','funcao','public.cash_month'),
  ('20261104120000','gatilho','public.cash_settlements:trg_cash_settlements_append_only'),
  ('20261104120000','gatilho','public.commission_splits:trg_cash_split_no_auto_paid'),
  ('20261104120000','gatilho','public.payments:trg_cash_guard'),
  ('20261104120000','gatilho','public.expenses:trg_cash_guard'),
  ('20261104120000','gatilho','public.commission_splits:trg_cash_guard'),
  ('20261104120000','gatilho','public.payments:trg_cash_capture'),
  ('20261104120000','gatilho','public.expenses:trg_cash_capture'),
  ('20261104120000','gatilho','public.commission_splits:trg_cash_capture'),
  ('20261104120000','gatilho','public.commissions:trg_cash_capture')
),
conferido AS (
  SELECT e.migration, e.tipo, e.objeto,
    CASE
      WHEN e.tipo = 'funcao' AND EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname || '.' || p.proname = e.objeto) THEN 'OK'
      WHEN e.tipo = 'visao' AND EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname || '.' || c.relname = e.objeto AND c.relkind IN ('v','m')) THEN 'OK'
      WHEN e.tipo = 'tabela' AND EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname || '.' || c.relname = e.objeto AND c.relkind IN ('r','p') AND c.relrowsecurity) THEN 'OK'
      WHEN e.tipo = 'tabela' AND EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname || '.' || c.relname = e.objeto AND c.relkind IN ('r','p')) THEN 'SEM RLS'
      WHEN e.tipo = 'coluna' AND EXISTS (
        SELECT 1 FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname || '.' || c.relname || '.' || a.attname = e.objeto
           AND a.attnum > 0 AND NOT a.attisdropped) THEN 'OK'
      WHEN e.tipo = 'gatilho' AND EXISTS (
        SELECT 1 FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname || '.' || c.relname || ':' || t.tgname = e.objeto
           AND NOT t.tgisinternal) THEN 'OK'
      WHEN e.tipo = 'restricao' AND EXISTS (
        SELECT 1 FROM pg_constraint r
          JOIN pg_class c ON c.oid = r.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname || '.' || c.relname || ':' || r.conname = e.objeto) THEN 'OK'
      ELSE 'FALTA'
    END AS situacao
  FROM esperado e
)
SELECT migration, tipo, objeto, situacao
FROM (
  SELECT migration, 'RESUMO' AS tipo,
         count(*) FILTER (WHERE situacao = 'OK') || ' de ' || count(*) AS objeto,
         CASE WHEN bool_and(situacao = 'OK') THEN 'OK'
              WHEN bool_or(situacao = 'FALTA') THEN 'FALTA'
              ELSE 'SEM RLS' END AS situacao,
         0 AS ordem
    FROM conferido
   GROUP BY migration
  UNION ALL
  SELECT migration, tipo, objeto, situacao, 1 AS ordem
    FROM conferido
) x
ORDER BY migration, ordem, situacao, tipo, objeto;
