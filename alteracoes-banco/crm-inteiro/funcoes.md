# Funções

210 funções, 212 assinaturas. **Versão final** é a migration e a linha que valem hoje: as versões anteriores da mesma função foram substituídas e não devem ser reaplicadas.

Definer indica `SECURITY DEFINER`.

| Função | Argumentos | Retorno | Definer | Versões | Versão final | Usada por |
|---|---|---|---|---:|---|---|
| `private.actor_email` | _uid uuid | text | sim | 1 | `20260702212656`:57 | função: trg_commission_splits_audit, trg_commissions_audit, trg_payments_audit |
| `private.can_access_cash` | _user_id uuid | boolean | sim | 1 | `20261104120000`:96 | função: private.can_operate_cash, cash_can_access, cash_cancel_income +4 |
| `private.can_access_task` | _uid uuid, _task_id uuid | boolean | sim | 1 | `20260518103022`:33 | sem uso direto encontrado |
| `private.can_operate_cash` | _user_id uuid | boolean | sim | 1 | `20261104120000`:113 | função: cash_confirm_historic, cash_receive_for_sale, cash_refund_payment +3 |
| `private.cash_capture_commission` |  | trigger | sim | 1 | `20261104120000`:542 | gatilho: commissions:trg_cash_capture |
| `private.cash_capture_expense` |  | trigger | sim | 1 | `20261104120000`:490 | gatilho: expenses:trg_cash_capture |
| `private.cash_capture_payment` |  | trigger | sim | 1 | `20261104120000`:456 | gatilho: payments:trg_cash_capture |
| `private.cash_capture_split` |  | trigger | sim | 1 | `20261104120000`:516 | gatilho: commission_splits:trg_cash_capture |
| `private.cash_default_account` |  | uuid | não | 1 | `20261104120000`:173 | função: private.cash_capture_expense, private.cash_capture_payment, private.cash_capture_split +3 |
| `private.cash_guard_source` |  | trigger | sim | 1 | `20261104120000`:424 | gatilho: commission_splits:trg_cash_guard, expenses:trg_cash_guard, payments:trg_cash_guard |
| `private.cash_mirror_source` | p_type text, p_id uuid | void | sim | 1 | `20261104120000`:194 | função: cash_refund_payment, cash_reverse, cash_reverse_source +1 |
| `private.cash_movement` | p_from date, p_to date | TABLE (entradas numeric, saidas numeric, nao_confirmado numeric) | sim | 1 | `20261104120000`:1178 | função: cash_month |
| `private.cash_net_settled` | p_type text, p_id uuid | numeric | não | 1 | `20261104120000`:181 | função: private.cash_capture_expense, private.cash_capture_payment, private.cash_capture_split +9 |
| `private.cash_obligations` |  | TABLE ( source_type text, source_id uuid, direction text, description text, counterparty text, origin_label text, sale_id uuid, client_id uuid, due_date date, amount numeric, settled numeric, balance numeric, is_estimate boolean, in_projection boolean) | sim | 1 | `20261104120000`:1107 | função: cash_month |
| `private.cash_reverse_amount` | p_type text, p_id uuid, p_amount numeric, p_kind text, p_reason text, p_date date, p_origin text | void | sim | 1 | `20261104120000`:271 | função: private.cash_capture_expense, private.cash_capture_payment, private.cash_capture_split +2 |
| `private.cash_settlements_append_only` |  | trigger | não | 1 | `20261104120000`:149 | gatilho: cash_settlements:trg_cash_settlements_append_only |
| `private.cash_split_no_auto_paid` |  | trigger | sim | 1 | `20261104120000`:352 | gatilho: commission_splits:trg_cash_split_no_auto_paid |
| `private.cash_today` |  | date | não | 1 | `20261104120000`:167 | função: private.cash_capture_expense, private.cash_capture_payment, private.cash_capture_split +7 |
| `private.check_is_admin` | _user_id uuid DEFAULT auth.uid() | boolean | sim | 1 | `20260511233653`:48 | sem uso direto encontrado |
| `private.check_user_role` | _user_id uuid, _role text | boolean | sim | 1 | `20260511233653`:58 | sem uso direto encontrado |
| `private.divert_client_product_money` |  | trigger | sim | 1 | `20261103210000`:69 | gatilho: client_products:zz_divert_client_product_money |
| `private.effective_visibility` | p_sale_id uuid, p_kind text, p_id uuid | TABLE (see_gross boolean, see_payments boolean, see_deductions boolean) | sim | 1 | `20261103230000`:79 | função: my_commission_statement, my_sale_disclosure |
| `private.generate_sale_payments` | p_sale_id uuid | integer | sim | 1 | `20261103260000`:23 | função: regenerate_sale_payments, sync_sale_financial_schedule |
| `private.goal_actuals` | p_month date, p_stage_ids uuid[] DEFAULT NULL | jsonb | sim | 1 | `20261103260000`:149 | função: recompute_sales_goals_for_month, sales_goal_actuals |
| `private.has_role` | _user_id uuid, _role public.app_role | boolean | sim | 1 | `20260511233653`:8 | função: private.can_access_task, enforce_partner_contract_field_scope |
| `private.is_admin` |  | boolean | sim | 8 | `20260630233925`:31 | função: private.can_access_task, private.can_operate_cash, private.check_is_admin +4 |
| `private.is_admin` | _user_id uuid | boolean | sim | 8 | `20260630233925`:45 | função: private.can_access_task, private.can_operate_cash, private.check_is_admin +4 |
| `private.is_collaborator_for_client` | _user_id uuid, _client_id uuid | boolean | sim | 2 | `20260519105847`:2 | função: private.is_collaborator_for_sale |
| `private.is_collaborator_for_client_product` | _user_id uuid, _client_product_id uuid | boolean | sim | 1 | `20260519105847`:22 | sem uso direto encontrado |
| `private.is_collaborator_for_sale` | _user_id uuid, _sale_id uuid | boolean | sim | 1 | `20260519105847`:41 | sem uso direto encontrado |
| `private.is_delegated_provider` | _user_id uuid, _client_product_id uuid | boolean | sim | 5 | `20260607034703`:3 | função: private.can_access_task, private.storage_documents_can_insert, private.storage_documents_can_read +4 |
| `private.is_partner_for_client` | _user_id uuid, _client_id uuid | boolean | sim | 2 | `20260629190651`:1 | função: private.storage_documents_can_insert, private.storage_documents_can_read, user_involved_in_demand |
| `private.is_primary_admin` | _uid uuid | boolean | sim | 1 | `20260526121312`:3 | sem uso direto encontrado |
| `private.is_provider_user` | _user_id uuid, _provider_id uuid | boolean | sim | 1 | `20261024160000`:42 | sem uso direto encontrado |
| `private.is_referrer_for_client` | _user_id uuid, _client_id uuid | boolean | sim | 1 | `20260519105209`:18 | sem uso direto encontrado |
| `private.is_secondary_provider_for_client_product` | _user_id uuid, _client_product_id uuid | boolean | sim | 1 | `20260605172037`:1 | função: private.is_delegated_provider |
| `private.my_beneficiaries` |  | TABLE (kind text, id uuid) | sim | 1 | `20261103230000`:54 | função: my_commission_statement, my_sale_disclosure |
| `private.paid_split_total` | p_sale_id uuid, p_type text, p_beneficiary uuid | numeric | sim | 1 | `20261103250000`:39 | função: handle_sale_splits |
| `private.provider_has_document_share` | _user_id uuid, _document_id uuid, _file_path text | boolean | sim | 1 | `20261024160000`:21 | sem uso direto encontrado |
| `private.provisions_from_changed_rows` |  | trigger | sim | 1 | `20261103240000`:394 | gatilho: payments:trg_payments_provisions_del, payments:trg_payments_provisions_ins, payments:trg_payments_provisions_upd +3 |
| `private.recompute_sale_release` | p_sale_id uuid, p_reverted boolean DEFAULT false | void | sim | 3 | `20261104120000`:304 | função: private.sales_recompute_release, maybe_release_commission |
| `private.regenerate_sale_provisions` | p_sale_id uuid | void | sim | 2 | `20261103250000`:311 | função: private.provisions_from_changed_rows, private.sales_regenerate_provisions |
| `private.sale_deduction_totals` | p_sale_id uuid, p_amount numeric | TABLE (costs_zenon numeric, costs_provider numeric) | sim | 1 | `20261103220000`:119 | função: private.sale_deductions_sync_sale, private.sales_apply_deductions |
| `private.sale_deductions_sync_sale` |  | trigger | sim | 1 | `20261103220000`:169 | gatilho: sale_deductions:trg_sale_deductions_sync_del, sale_deductions:trg_sale_deductions_sync_ins, sale_deductions:trg_sale_deductions_sync_upd |
| `private.sale_received` | p_sale_id uuid | numeric | sim | 1 | `20261103240000`:149 | função: private.recompute_sale_release |
| `private.sales_apply_deductions` |  | trigger | sim | 1 | `20261103220000`:141 | gatilho: sales:trg_sales_apply_deductions |
| `private.sales_mark_conversion` |  | trigger | sim | 1 | `20261103250000`:368 | gatilho: sales:trg_sales_mark_conversion |
| `private.sales_recompute_release` |  | trigger | sim | 1 | `20261103240000`:277 | gatilho: sales:on_sale_zz_recompute_release |
| `private.sales_regenerate_provisions` |  | trigger | sim | 1 | `20261103240000`:431 | gatilho: sales:trg_sales_regenerate_provisions |
| `private.storage_documents_can_insert` | _user_id uuid, _email text, _object_name text | boolean | sim | 3 | `20260703202246`:2 | sem uso direto encontrado |
| `private.storage_documents_can_read` | _user_id uuid, _email text, _object_name text | boolean | sim | 5 | `20260703202422`:2 | sem uso direto encontrado |
| `private.storage_is_internal` | _user_id uuid | boolean | sim | 2 | `20260630233233`:1 | função: private.storage_documents_can_insert, private.storage_documents_can_read, private.storage_partner_contracts_can_insert +2 |
| `private.storage_partner_contracts_can_insert` | _user_id uuid, _email text, _object_name text | boolean | sim | 1 | `20260630222102`:252 | sem uso direto encontrado |
| `private.storage_partner_contracts_can_read` | _user_id uuid, _email text, _object_name text | boolean | sim | 1 | `20260630222102`:229 | sem uso direto encontrado |
| `private.storage_partner_id_for_user` | _user_id uuid, _email text | uuid | sim | 1 | `20260630222102`:65 | função: private.storage_documents_can_insert, private.storage_documents_can_read, private.storage_partner_contracts_can_insert +2 |
| `private.storage_partner_materials_can_read` | _user_id uuid, _email text, _object_name text | boolean | sim | 1 | `20260630222102`:265 | sem uso direto encontrado |
| `private.storage_provider_id_for_user` | _user_id uuid, _email text | uuid | sim | 1 | `20260630222102`:97 | função: private.storage_documents_can_insert, private.storage_documents_can_read |
| `private.storage_referrer_id_for_user` | _user_id uuid, _email text | uuid | sim | 1 | `20260630222102`:81 | função: private.storage_documents_can_read |
| `public.admin_dashboard_snapshot` | p_range_key text DEFAULT 'HOJE'::text | jsonb | sim | 5 | `20260702141553`:1 | tela: pages/DashboardAdmin.tsx |
| `public.admin_delete_client_cascade` | _client_id uuid | void | sim | 1 | `20260521004603`:1 | tela: pages/Clients.tsx |
| `public.admin_delete_product_cascade` | _product_id uuid, _force boolean DEFAULT false | jsonb | sim | 2 | `20260526150701`:1 | tela: components/products/DeleteProductDialog.tsx |
| `public.apply_pool_movement` |  | trigger | sim | 1 | `20260626051143`:80 | gatilho: resource_pool_movements:trg_apply_pool_movement |
| `public.calculate_sla_due_date` | start_date timestamp with time zone, days_to_add integer, day_type text | timestamp with time zone | não | 2 | `20260511231808`:7 | função: set_client_product_sla |
| `public.can_access_product_folder` | _folder_id uuid, _user_id uuid | boolean | sim | 2 | `20260701131523`:8 | sem uso direto encontrado |
| `public.can_access_signature_object` | _name text | boolean | sim | 1 | `20260703204434`:74 | sem uso direto encontrado |
| `public.can_access_signature_stage` | _stage_id uuid | boolean | sim | 1 | `20260703204434`:34 | função: can_access_signature_object |
| `public.cash_can_access` |  | boolean | sim | 1 | `20261104120000`:125 | tela: lib/cashFlow.ts |
| `public.cash_cancel_income` | p_id uuid, p_reason text | void | sim | 1 | `20261104120000`:1058 | sem uso direto encontrado |
| `public.cash_confirm_historic` | p_settlement_id uuid | void | sim | 1 | `20261104120000`:978 | tela: lib/cashFlow.ts |
| `public.cash_convert_monthly_sale` | p_sale_id uuid, p_reason text | numeric | sim | 1 | `20261104120000`:933 | sem uso direto encontrado |
| `public.cash_create_entry` | p_direction text, p_description text, p_amount numeric, p_date date, p_realized boolean, p_category text DEFAULT NULL, p_counterparty text DEFAULT NULL, p_client_id uuid DEFAULT NULL, p_notes text DEFAULT NULL, p_payment_method text DEFAULT NULL, p_idempotency_key text DEFAULT NULL | uuid | sim | 1 | `20261104120000`:995 | tela: lib/cashFlow.ts |
| `public.cash_month` | p_month date, p_include_overdue boolean DEFAULT false | jsonb | sim | 1 | `20261104120000`:1197 | tela: lib/cashFlow.ts |
| `public.cash_receive_for_sale` | p_sale_id uuid, p_amount numeric, p_effective_date date, p_payment_method text DEFAULT NULL, p_notes text DEFAULT NULL, p_idempotency_key text DEFAULT NULL | integer | sim | 1 | `20261104120000`:692 | tela: lib/cashFlow.ts |
| `public.cash_refund_payment` | p_payment_id uuid, p_amount numeric, p_reason text | void | sim | 1 | `20261104120000`:877 | tela: lib/cashFlow.ts |
| `public.cash_reverse` | p_settlement_id uuid, p_amount numeric, p_reason text, p_effective_date date DEFAULT NULL, p_kind text DEFAULT 'estorno', p_idempotency_key text DEFAULT NULL | uuid | sim | 1 | `20261104120000`:770 | tela: lib/cashFlow.ts |
| `public.cash_reverse_source` | p_source_type text, p_source_id uuid, p_reason text | void | sim | 1 | `20261104120000`:844 | tela: lib/cashFlow.ts |
| `public.cash_set_opening_balance` | p_reference_date date, p_amount numeric, p_reason text | uuid | sim | 1 | `20261104120000`:1078 | tela: lib/cashFlow.ts |
| `public.cash_settle` | p_source_type text, p_source_id uuid, p_amount numeric, p_effective_date date, p_payment_method text DEFAULT NULL, p_notes text DEFAULT NULL, p_idempotency_key text DEFAULT NULL | uuid | sim | 1 | `20261104120000`:599 | tela: lib/cashFlow.ts; função: cash_create_entry, cash_receive_for_sale |
| `public.check_is_admin` | _user_id uuid DEFAULT auth.uid() | boolean | sim | 2 | `20260511231808`:30 | sem uso direto encontrado |
| `public.check_overdue_documents` |  | void | sim | 2 | `20260508205032`:80 | sem uso direto encontrado |
| `public.check_pending_commissions` |  | void | sim | 2 | `20260508205032`:46 | sem uso direto encontrado |
| `public.check_user_role` | _user_id uuid, _role text | boolean | sim | 2 | `20260511231808`:45 | sem uso direto encontrado |
| `public.client_submit_payment_receipt` | _payment_id uuid, _receipt_path text | void | sim | 1 | `20260630235914`:1 | tela: components/client/PaymentReceiptDialog.tsx |
| `public.clients_client_self_update_guard` |  | trigger | sim | 1 | `20260701153155`:11 | gatilho: clients:trg_clients_client_self_update_guard |
| `public.commissions_set_paid_dates` |  | trigger | sim | 1 | `20260520012017`:38 | gatilho: commissions:trg_commissions_set_paid_dates |
| `public.complete_client_onboarding` |  | void | sim | 2 | `20260521010213`:55 | sem uso direto encontrado |
| `public.create_notification` | p_user_id uuid, p_title text, p_message text, p_type text DEFAULT 'info'::text, p_link text DEFAULT NULL::text | uuid | sim | 3 | `20260520015750`:96 | função: check_overdue_documents, check_pending_commissions |
| `public.credit_project_pool_on_payment` |  | TRIGGER | sim | 2 | `20260626070729`:7 | gatilho: payments:trg_credit_project_pool |
| `public.enforce_demand_link_on_documents` |  | trigger | não | 4 | `20261102120000`:5 | gatilho: documents:trg_enforce_demand_link_on_documents |
| `public.enforce_partner_contract_field_scope` |  | trigger | sim | 1 | `20260707013606`:27 | gatilho: partner_contracts:trg_enforce_partner_contract_field_scope |
| `public.ensure_default_role_on_profile` |  | trigger | sim | 1 | `20260521135007`:32 | gatilho: profiles:trg_ensure_default_role_on_profile |
| `public.fill_client_product_provider` |  | trigger | sim | 2 | `20260521134042`:189 | gatilho: client_products:trg_fill_client_product_provider |
| `public.fill_client_product_responsible` |  | trigger | sim | 2 | `20260521134042`:172 | gatilho: client_products:trg_fill_client_product_responsible |
| `public.fill_demand_request_client` |  | trigger | sim | 1 | `20260626052438`:30 | gatilho: demand_requests:trg_fill_demand_request_client |
| `public.fill_payment_links_from_sale` |  | trigger | sim | 1 | `20260521134042`:466 | gatilho: payments:trg_fill_payment_links_from_sale |
| `public.fill_sale_links_from_client` |  | trigger | sim | 1 | `20260521134042`:64 | gatilho: sales:trg_fill_sale_links_from_client |
| `public.fill_task_assigned_from_demand` |  | trigger | sim | 3 | `20260521134042`:260 | gatilho: tasks:trg_fill_task_assigned_from_demand |
| `public.financial_consistency_report` |  | TABLE (check_code text, check_name text, severity text, problems bigint) | sim | 1 | `20260702213048`:2 | tela: components/finance/ConsistencyReport.tsx |
| `public.force_owner_created_by` |  | trigger | não | 1 | `20260707014228`:43 | gatilho: product_document_folders:trg_force_owner_created_by_folders |
| `public.force_owner_uploaded_by` |  | trigger | não | 1 | `20260707014228`:55 | gatilho: product_document_files:trg_force_owner_uploaded_by_files |
| `public.handle_checklist_step_change` |  | trigger | sim | 1 | `20260518102845`:37 | gatilho: client_product_steps:trg_checklist_step_change |
| `public.handle_demand_pause` |  | trigger | não | 2 | `20260511231808`:75 | gatilho: client_product_pauses:tr_handle_demand_pause |
| `public.handle_new_sale` |  | trigger | sim | 14 | `20261103250000`:130 | gatilho: sales:on_sale_created |
| `public.handle_new_user` |  | trigger | sim | 5 | `20260511233653`:180 | gatilho: auth.users:on_auth_user_created |
| `public.handle_payment_update` |  | TRIGGER | sim | 1 | `20260518093104`:59 | gatilho: payments:on_payment_updated |
| `public.handle_sale_splits` |  | trigger | sim | 10 | `20261103250000`:56 | gatilho: sales:on_sale_created_splits |
| `public.has_role` | _user_id UUID, _role public.app_role | BOOLEAN | sim | 2 | `20260428144839`:31 | função: can_access_signature_stage, clients_client_self_update_guard |
| `public.is_admin` |  | boolean | sim | 7 | `20260630233925`:1 | função: admin_dashboard_snapshot, admin_delete_client_cascade, admin_delete_product_cascade +3 |
| `public.is_admin` | _user_id uuid | boolean | sim | 7 | `20260630233925`:17 | função: admin_dashboard_snapshot, admin_delete_client_cascade, admin_delete_product_cascade +3 |
| `public.is_assigned_provider` | _user_id uuid, _cp_id uuid | boolean | sim | 1 | `20260701130015`:3 | sem uso direto encontrado |
| `public.is_client_of_product` | _client_product_id uuid, _user_id uuid | boolean | sim | 1 | `20260701130430`:18 | função: can_access_product_folder |
| `public.is_delegated_provider` | _user_id uuid, _client_product_id uuid | boolean | sim | 4 | `20260519105209`:71 | sem uso direto encontrado |
| `public.is_provider_owner` | _user_id uuid, _provider_id uuid | boolean | sim | 1 | `20260518082617`:3 | sem uso direto encontrado |
| `public.is_super_admin` | _user_id uuid DEFAULT auth.uid() | boolean | sim | 1 | `20260626051143`:7 | sem uso direto encontrado |
| `public.lock_created_by_column` |  | trigger | não | 1 | `20260707014228`:78 | gatilho: product_document_folders:trg_lock_created_by_folders |
| `public.lock_uploaded_by_column` |  | trigger | não | 1 | `20260707014228`:92 | gatilho: product_document_files:trg_lock_uploaded_by_files |
| `public.log_action` | p_action TEXT, p_entity_type TEXT, p_entity_id UUID, p_old_value JSONB DEFAULT NULL, p_new_value JSONB DEFAULT NULL | VOID | sim | 1 | `20260506235128`:45 | sem uso direto encontrado |
| `public.log_activity` |  | trigger | sim | 5 | `20260511231808`:140 | gatilho: client_product_status_reports:log_status_reports_activity, client_products:log_client_products_activity, clients:log_clients_activity +12 |
| `public.log_client_journey_change` |  | trigger | sim | 1 | `20260626052438`:174 | gatilho: clients:trg_log_client_journey |
| `public.log_client_stage_change` |  | TRIGGER | sim | 2 | `20260702152910`:27 | gatilho: clients:trg_log_client_stage_change |
| `public.log_demand_activity` | _client_product_id uuid, _action text, _description text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb | uuid | não | 2 | `20260511233653`:255 | tela: lib/demand.ts |
| `public.log_demand_comment` |  | trigger | sim | 2 | `20260702203703`:1 | gatilho: demand_comments:trg_log_demand_comment |
| `public.log_demand_delivery` |  | trigger | sim | 1 | `20260630225347`:132 | gatilho: demand_deliveries:trg_log_demand_delivery |
| `public.log_demand_document_event` |  | trigger | sim | 1 | `20260630225347`:155 | gatilho: documents:trg_log_demand_document |
| `public.log_demand_report` |  | trigger | sim | 1 | `20260630225347`:50 | gatilho: client_product_status_reports:trg_log_demand_report |
| `public.log_demand_request` |  | trigger | sim | 1 | `20260630225347`:105 | gatilho: demand_requests:trg_log_demand_request |
| `public.log_demand_status_change` |  | trigger | sim | 1 | `20260630225347`:8 | gatilho: client_products:trg_log_demand_status |
| `public.log_lead_change` |  | trigger | sim | 2 | `20260520023441`:3 | gatilho: leads:trg_log_lead_change |
| `public.mark_client_closed_on_sale_finalized` |  | TRIGGER | sim | 1 | `20260626061407`:6 | gatilho: sales:trg_mark_client_closed |
| `public.mark_overdue_payments` |  | void | sim | 1 | `20260509213222`:2 | sem uso direto encontrado |
| `public.maybe_release_commission` |  | trigger | sim | 5 | `20261103240000`:246 | gatilho: payments:trg_payments_release_commission |
| `public.my_commission_statement` |  | TABLE ( split_id uuid, beneficiary_type text, sale_id uuid, client_id uuid, client_name text, product_name text, client_product_id uuid, status text, paid_at timestamptz, created_at timestamptz, percent numeric, amount numeric, released_amount numeric, base_calculo numeric, revenue_type text, recurrence_months integer, gross_amount numeric, can_see_payments boolean, can_see_deductions boolean ) | sim | 3 | `20261103240000`:457 | tela: pages/PartnerPanel.tsx, pages/ProviderPanel.tsx, pages/ReferrerPanel.tsx |
| `public.my_sale_disclosure` | p_sale_id uuid | jsonb | sim | 1 | `20261103230000`:168 | tela: components/visibility/SaleDisclosureDialog.tsx |
| `public.normalize_client_alias_fields` |  | trigger | não | 1 | `20260521134042`:2 | gatilho: clients:trg_normalize_client_alias_fields |
| `public.notification_enabled` | _user_id uuid, _type text | boolean | sim | 1 | `20260701140044`:29 | função: notify_client_support_message, notify_demand_comment_all, notify_demand_request_message +1 |
| `public.notify_admins` | p_title TEXT, p_message TEXT, p_link TEXT, p_type TEXT | void | sim | 1 | `20260507023356`:3 | função: notify_demand_request, notify_on_commission_status, notify_on_contract +7 |
| `public.notify_admins_on_new_partner_ticket` |  | TRIGGER | sim | 2 | `20260703215903`:23 | gatilho: partner_support_tickets:trg_notify_admins_new_partner_ticket |
| `public.notify_admins_on_partner_support_message` |  | TRIGGER | sim | 2 | `20260703215903`:2 | gatilho: partner_support_ticket_messages:trg_notify_admins_partner_support_msg |
| `public.notify_admins_on_partner_ticket_message` |  | TRIGGER | sim | 2 | `20260701142658`:1 | gatilho: partner_support_ticket_messages:trg_notify_admins_partner_ticket_msg |
| `public.notify_assignee_on_task_comment` |  | TRIGGER | sim | 1 | `20260703212039`:162 | gatilho: task_comments:trg_notify_task_comment |
| `public.notify_client_on_new_delivery` |  | TRIGGER | sim | 1 | `20260703212039`:48 | gatilho: demand_deliveries:trg_notify_client_delivery |
| `public.notify_client_support_message` |  | trigger | sim | 1 | `20260701140702`:132 | gatilho: client_support_ticket_messages:trg_notify_client_support_message |
| `public.notify_collaborator_on_demand_assign` |  | TRIGGER | sim | 1 | `20260703212039`:126 | gatilho: client_products:trg_notify_collab_demand_assign |
| `public.notify_collaborator_on_demand_status_change` |  | TRIGGER | sim | 1 | `20260703212039`:145 | gatilho: client_products:trg_notify_collab_demand_status |
| `public.notify_demand_comment_all` |  | trigger | sim | 4 | `20260703203824`:2 | gatilho: demand_comments:trg_notify_demand_comment_all |
| `public.notify_demand_comment_mentions` |  | trigger | sim | 2 | `20260704024254`:1 | gatilho: demand_comments:trg_notify_demand_comment_mentions |
| `public.notify_demand_request` |  | trigger | sim | 1 | `20260626052438`:91 | gatilho: demand_requests:trg_notify_demand_request |
| `public.notify_demand_request_message` |  | trigger | sim | 1 | `20260701140702`:83 | gatilho: demand_request_messages:trg_notify_demand_request_message |
| `public.notify_demand_status_change` |  | trigger | sim | 2 | `20260701140702`:45 | gatilho: client_products:trg_notify_demand_status_change |
| `public.notify_document_recipient` |  | trigger | sim | 1 | `20260605164148`:84 | gatilho: documents:trg_notify_document_recipient |
| `public.notify_on_commission_status` |  | trigger | sim | 1 | `20260507023356`:54 | gatilho: commissions:trg_notify_commission |
| `public.notify_on_contract` |  | trigger | sim | 2 | `20260508194041`:1 | gatilho: contracts:trg_notify_contract_ins, contracts:trg_notify_contract_upd |
| `public.notify_on_contract_change` |  | trigger | sim | 2 | `20260517220052`:72 | sem uso direto encontrado |
| `public.notify_on_document` |  | trigger | sim | 2 | `20260513022421`:2 | gatilho: documents:trg_notify_document |
| `public.notify_on_document_request_change` |  | trigger | sim | 2 | `20260517220052`:84 | gatilho: document_requests:trigger_notify_on_document_request_change |
| `public.notify_on_lead` |  | trigger | sim | 2 | `20260517220052`:169 | gatilho: leads:trg_notify_lead |
| `public.notify_on_partner_ticket` |  | trigger | sim | 1 | `20260630191752`:50 | gatilho: partner_support_tickets:trg_partner_ticket_notify |
| `public.notify_on_sale` |  | trigger | sim | 1 | `20260507023356`:18 | gatilho: sales:trg_notify_sale |
| `public.notify_on_task_assign` |  | trigger | sim | 1 | `20260507023356`:96 | gatilho: tasks:trg_notify_task_ins, tasks:trg_notify_task_upd |
| `public.notify_partner_on_admin_ticket_reply` |  | TRIGGER | sim | 1 | `20260703212039`:70 | gatilho: partner_support_ticket_messages:trg_notify_partner_admin_reply |
| `public.notify_partner_on_contract_signed` |  | TRIGGER | sim | 1 | `20260703212039`:106 | gatilho: partner_contracts:trg_notify_partner_contract_signed |
| `public.notify_partners_on_new_material` |  | TRIGGER | sim | 1 | `20260703212039`:89 | gatilho: partner_materials:trg_notify_partners_new_material |
| `public.notify_provider_on_client_document_upload` |  | TRIGGER | sim | 1 | `20260703212039`:24 | gatilho: documents:trg_notify_provider_client_doc |
| `public.notify_provider_on_demand_assign` |  | TRIGGER | sim | 1 | `20260703212039`:3 | gatilho: client_products:trg_notify_provider_demand_assign |
| `public.notify_provider_on_document_share` |  | trigger | sim | 1 | `drizzle 0000`:60 | gatilho: document_shares:trg_notify_provider_document_share |
| `public.notify_tasks_due_today` |  | void | sim | 1 | `20260521011908`:44 | sem uso direto encontrado |
| `public.on_contract_status_change` |  | trigger | sim | 2 | `20260517220052`:3 | gatilho: contracts:tr_on_contract_status_change |
| `public.on_status_report_inserted` |  | trigger | sim | 2 | `20260517220052`:139 | gatilho: client_product_status_reports:trg_on_status_report_inserted |
| `public.on_support_message` |  | trigger | sim | 1 | `drizzle 0000`:121 | gatilho: support_ticket_messages:trg_on_support_message |
| `public.populate_client_product_from_template` |  | trigger | sim | 5 | `20260521134042`:397 | gatilho: client_products:tr_populate_client_product |
| `public.prevent_partner_self_privilege_change` |  | trigger | sim | 1 | `20260626071425`:3 | gatilho: partners:trg_prevent_partner_self_privilege_change |
| `public.propagate_client_collaborator` |  | trigger | sim | 4 | `20260521134042`:206 | gatilho: clients:trg_propagate_client_collaborator |
| `public.propagate_client_provider` |  | trigger | sim | 4 | `20260521134042`:237 | gatilho: clients:trg_propagate_client_provider |
| `public.provider_can_read_shared_file` | _user_id uuid, _path text | boolean | sim | 1 | `drizzle 0000`:40 | sem uso direto encontrado |
| `public.provider_client_dossier` | _client_id uuid | jsonb | sim | 2 | `20261103200000`:196 | tela: components/provider/ProviderClientDossier.tsx |
| `public.provider_client_profiles` |  | TABLE(client_id uuid, full_name text, document text, birth_date date, email text, phone text, whatsapp text, company text, address_street text, address_number text, address_neighborhood text, city text, state text, address_zip_code text, source text, status text, created_at timestamp with time zone, ltv numeric, demands jsonb) | sim | 2 | `20261103200000`:120 | tela: components/provider/ProviderClients.tsx |
| `public.provider_has_demand_access` | _user_id uuid, _client_product_id uuid | boolean | sim | 1 | `20260626051143`:126 | função: provider_client_dossier, provider_client_profiles, user_involved_in_demand |
| `public.provider_has_document_share` | _user_id uuid, _document_id uuid | boolean | sim | 1 | `drizzle 0000`:33 | sem uso direto encontrado |
| `public.recompute_sales_goals_for_month` | p_month date | void | sim | 2 | `20261103260000`:233 | função: trg_recompute_goals_current_month |
| `public.regenerate_sale_payments` | p_sale_id uuid | integer | sim | 1 | `20261103260000`:123 | tela: components/sales/SaleFormDialog.tsx |
| `public.sales_goal_actuals` | p_month date, p_stage_ids uuid[] DEFAULT NULL | jsonb | sim | 1 | `20261103260000`:214 | tela: components/dashboard/GoalsPanel.tsx, pages/SalesGoals.tsx |
| `public.sales_set_closed_at` |  | trigger | sim | 2 | `20260626053430`:2 | gatilho: sales:trg_sales_closed_at |
| `public.seed_client_product_steps` |  | trigger | sim | 2 | `20260518102845`:2 | gatilho: client_products:trg_seed_client_product_steps |
| `public.set_audit_ip` |  | trigger | sim | 2 | `20260511231808`:215 | gatilho: audit_logs:tr_audit_logs_ip |
| `public.set_client_product_sla` |  | trigger | não | 2 | `20260511231808`:236 | gatilho: client_products:tr_set_client_product_sla |
| `public.set_sale_stage_snapshot` |  | TRIGGER | sim | 1 | `20260706160017`:4 | gatilho: sales:trg_set_sale_stage_snapshot |
| `public.set_updated_at` |  | TRIGGER | não | 1 | `20260428144839`:240 | gatilho: client_collaborators:trg_client_collaborators_updated_at, client_journey_stages:trg_journey_stages_updated_at, client_partners:trg_client_partners_updated_at +29 |
| `public.sync_client_document_request_to_document` |  | trigger | sim | 1 | `20260521134042`:325 | gatilho: client_document_requests:trg_sync_client_document_request_to_document |
| `public.sync_client_legacy_to_links` |  | trigger | sim | 1 | `20260605181735`:28 | gatilho: clients:trg_sync_client_legacy_to_links |
| `public.sync_client_status_from_journey_stage` |  | trigger | sim | 2 | `20260702152141`:1 | gatilho: clients:trg_sync_client_status_from_stage |
| `public.sync_commission_split_status` |  | trigger | sim | 3 | `20260520015750`:57 | gatilho: commissions:tr_sync_commission_split_status |
| `public.sync_commissions_for_payment` | p_payment_id uuid | void | sim | 1 | `20260702210531`:9 | função: trg_payments_sync_commissions |
| `public.sync_primary_collaborator_to_client` |  | trigger | sim | 1 | `20260605170316`:137 | gatilho: client_collaborators:trg_sync_primary_collaborator |
| `public.sync_primary_partner_to_client` |  | trigger | sim | 1 | `20260605170316`:98 | gatilho: client_partners:trg_sync_primary_partner |
| `public.sync_primary_provider_to_client` |  | trigger | sim | 1 | `20260605170316`:158 | gatilho: client_providers:trg_sync_primary_provider |
| `public.sync_primary_provider_to_demand` |  | trigger | sim | 1 | `20260605165827`:54 | gatilho: client_product_providers:trg_sync_primary_provider |
| `public.sync_primary_referrer_to_client` |  | trigger | sim | 1 | `20260605170316`:116 | gatilho: client_referrers:trg_sync_primary_referrer |
| `public.sync_sale_financial_schedule` |  | trigger | sim | 2 | `20261103260000`:92 | gatilho: sales:trg_sync_sale_financial_schedule |
| `public.sync_sale_to_client_product` |  | trigger | sim | 4 | `20261103210000`:204 | gatilho: sales:trg_sync_sale_to_client_product_ins, sales:trg_sync_sale_to_client_product_upd |
| `public.sync_splits_for_payment` | p_payment_id uuid | void | sim | 2 | `20261103210000`:107 | função: trg_payments_sync_splits |
| `public.sync_task_status_legacy` |  | trigger | não | 1 | `20260521135007`:6 | gatilho: tasks:trg_sync_task_status_legacy |
| `public.touch_cst_last_message` |  | trigger | não | 1 | `20260701002113`:58 | gatilho: client_support_ticket_messages:trg_cst_touch |
| `public.trg_commission_splits_audit` |  | trigger | sim | 1 | `20260702212656`:161 | gatilho: commission_splits:commission_splits_audit_trg |
| `public.trg_commissions_audit` |  | trigger | sim | 1 | `20260702212656`:107 | gatilho: commissions:commissions_audit_trg |
| `public.trg_payments_audit` |  | trigger | sim | 1 | `20260702212656`:68 | gatilho: payments:payments_audit_trg |
| `public.trg_payments_sync_commissions` |  | trigger | sim | 1 | `20260702210531`:99 | sem uso direto encontrado |
| `public.trg_payments_sync_splits` |  | trigger | sim | 1 | `20260704093814`:116 | gatilho: payments:trg_payments_sync_splits |
| `public.trg_recompute_goals_current_month` |  | trigger | sim | 2 | `20261103260000`:266 | gatilho: clients:trg_goals_on_client_stage, payments:trg_goals_on_payment, sales:trg_goals_on_sale |
| `public.update_client_products_updated_at` |  | TRIGGER | não | 1 | `20260506214504`:40 | gatilho: client_products:tr_client_products_updated_at |
| `public.update_profit_reserves_updated_at` |  | TRIGGER | não | 1 | `20260702144834`:26 | gatilho: profit_reserves:trg_profit_reserves_updated_at |
| `public.update_updated_at_column` |  | trigger | não | 6 | `20260511231808`:254 | gatilho: activity_goals:trg_activity_goals_updated_at, automation_rules:trg_automation_rules_updated, client_document_folders:trg_cdf_updated +27 |
| `public.user_involved_in_demand` | _user_id uuid, _client_product_id uuid | boolean | sim | 2 | `20260629190651`:23 | função: private.storage_documents_can_insert, private.storage_documents_can_read, can_access_product_folder |

## Removidas de propósito

Não recriar.

| Função | Removida em |
|---|---|
| `public.generate_commission_splits` | `20260520015750` |
| `public.guard_partner_contracts_admin_fields` | `20260707013606` |
| `public.prevent_partner_contract_admin_field_change` | `20260707013606` |
| `public.protect_partner_contract_admin_fields` | `20260707013606` |
