# Gatilhos

200 gatilhos no estado final. Última migration que criou cada um.

| Tabela | Gatilho | Quando | Função | Migration |
|---|---|---|---|---|
| `auth.users` | `on_auth_user_created` | AFTER INSERT | `public.handle_new_user` | `20260508205311`:30 |
| `public.activity_goals` | `trg_activity_goals_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260707002902`:41 |
| `public.audit_logs` | `tr_audit_logs_ip` | BEFORE INSERT | `public.set_audit_ip` | `20260509215150`:19 |
| `public.automation_rules` | `trg_automation_rules_updated` | BEFORE UPDATE | `public.update_updated_at_column` | `20260509215951`:39 |
| `public.cash_settlements` | `trg_cash_settlements_append_only` | BEFORE UPDATE OR DELETE | `private.cash_settlements_append_only` | `20261104120000`:417 |
| `public.client_collaborators` | `trg_client_collaborators_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260605170316`:71 |
| `public.client_collaborators` | `trg_sync_primary_collaborator` | AFTER INSERT OR UPDATE OR DELETE | `public.sync_primary_collaborator_to_client` | `20260605170316`:155 |
| `public.client_document_folders` | `trg_cdf_updated` | BEFORE UPDATE | `public.update_updated_at_column` | `20260701124414`:92 |
| `public.client_document_requests` | `trg_sync_client_document_request_to_document` | AFTER INSERT OR UPDATE OF title, description, status, file_url, due_date, client_product_id, client_id | `public.sync_client_document_request_to_document` | `20260521134042`:390 |
| `public.client_interactions` | `trg_client_interactions_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260518212444`:37 |
| `public.client_journey_stages` | `trg_journey_stages_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260626052438`:164 |
| `public.client_partners` | `trg_client_partners_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260605170316`:25 |
| `public.client_partners` | `trg_sync_primary_partner` | AFTER INSERT OR UPDATE OR DELETE | `public.sync_primary_partner_to_client` | `20260605170316`:113 |
| `public.client_product_pauses` | `tr_handle_demand_pause` | AFTER INSERT OR UPDATE | `public.handle_demand_pause` | `20260509235323`:74 |
| `public.client_product_providers` | `trg_cpp_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260605165827`:49 |
| `public.client_product_providers` | `trg_sync_primary_provider` | AFTER INSERT OR UPDATE OR DELETE | `public.sync_primary_provider_to_demand` | `20260605165827`:85 |
| `public.client_product_status_reports` | `log_status_reports_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260508194242`:35 |
| `public.client_product_status_reports` | `trg_log_demand_report` | AFTER INSERT | `public.log_demand_report` | `20260630225347`:74 |
| `public.client_product_status_reports` | `trg_on_status_report_inserted` | AFTER INSERT | `public.on_status_report_inserted` | `20260508192322`:161 |
| `public.client_product_steps` | `trg_checklist_step_change` | AFTER INSERT OR UPDATE OF status | `public.handle_checklist_step_change` | `20260518102845`:110 |
| `public.client_products` | `log_client_products_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260509215120`:108 |
| `public.client_products` | `tr_client_products_updated_at` | BEFORE UPDATE | `public.update_client_products_updated_at` | `20260506214504`:49 |
| `public.client_products` | `tr_populate_client_product` | AFTER INSERT | `public.populate_client_product_from_template` | `20260509235732`:97 |
| `public.client_products` | `tr_set_client_product_sla` | BEFORE INSERT | `public.set_client_product_sla` | `20260509235037`:57 |
| `public.client_products` | `trg_fill_client_product_provider` | BEFORE INSERT | `public.fill_client_product_provider` | `20260519113520`:19 |
| `public.client_products` | `trg_fill_client_product_responsible` | BEFORE INSERT | `public.fill_client_product_responsible` | `20260519113520`:51 |
| `public.client_products` | `trg_log_demand_status` | AFTER INSERT OR UPDATE | `public.log_demand_status_change` | `20260630225347`:45 |
| `public.client_products` | `trg_notify_collab_demand_assign` | AFTER INSERT OR UPDATE OF responsible_employee_id | `public.notify_collaborator_on_demand_assign` | `20260703212039`:140 |
| `public.client_products` | `trg_notify_collab_demand_status` | AFTER UPDATE OF status | `public.notify_collaborator_on_demand_status_change` | `20260703212039`:157 |
| `public.client_products` | `trg_notify_demand_status_change` | AFTER UPDATE OF status | `public.notify_demand_status_change` | `20260701140044`:121 |
| `public.client_products` | `trg_notify_provider_demand_assign` | AFTER INSERT OR UPDATE OF service_provider_id | `public.notify_provider_on_demand_assign` | `20260703212039`:19 |
| `public.client_products` | `trg_seed_client_product_steps` | AFTER INSERT | `public.seed_client_product_steps` | `20260510050051`:35 |
| `public.client_products` | `zz_divert_client_product_money` | BEFORE INSERT OR UPDATE | `private.divert_client_product_money` | `20261103210000`:102 |
| `public.client_providers` | `trg_client_providers_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260605170316`:94 |
| `public.client_providers` | `trg_sync_primary_provider` | AFTER INSERT OR UPDATE OR DELETE | `public.sync_primary_provider_to_client` | `20260605170316`:176 |
| `public.client_referrers` | `trg_client_referrers_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260605170316`:48 |
| `public.client_referrers` | `trg_sync_primary_referrer` | AFTER INSERT OR UPDATE OR DELETE | `public.sync_primary_referrer_to_client` | `20260605170316`:134 |
| `public.client_subscriptions` | `trg_subs_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260506154634`:153 |
| `public.client_support_ticket_messages` | `trg_cst_touch` | AFTER INSERT | `public.touch_cst_last_message` | `20260701002113`:64 |
| `public.client_support_ticket_messages` | `trg_notify_client_support_message` | AFTER INSERT | `public.notify_client_support_message` | `20260701140702`:167 |
| `public.clients` | `log_clients_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260509215120`:105 |
| `public.clients` | `trg_clients_client_self_update_guard` | BEFORE UPDATE | `public.clients_client_self_update_guard` | `20260701153155`:32 |
| `public.clients` | `trg_clients_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260428144839`:247 |
| `public.clients` | `trg_goals_on_client_stage` | AFTER UPDATE OF journey_stage_id | `public.trg_recompute_goals_current_month` | `20260701150904`:74 |
| `public.clients` | `trg_log_client_journey` | BEFORE UPDATE | `public.log_client_journey_change` | `20260626052438`:195 |
| `public.clients` | `trg_log_client_stage_change` | AFTER UPDATE OF journey_stage_id | `public.log_client_stage_change` | `20260702152910`:51 |
| `public.clients` | `trg_normalize_client_alias_fields` | BEFORE INSERT OR UPDATE OF collaborator_id, responsible_id, referrer_id, indicator_id, service_provider_id, provider_id | `public.normalize_client_alias_fields` | `20260521134042`:57 |
| `public.clients` | `trg_propagate_client_collaborator` | AFTER UPDATE OF collaborator_id | `public.propagate_client_collaborator` | `20260519113520`:56 |
| `public.clients` | `trg_propagate_client_provider` | AFTER UPDATE OF service_provider_id | `public.propagate_client_provider` | `20260519113520`:45 |
| `public.clients` | `trg_sync_client_legacy_to_links` | AFTER INSERT OR UPDATE OF partner_id, referrer_id, indicator_id, collaborator_id, responsible_id, service_provider_id, provider_id | `public.sync_client_legacy_to_links` | `20260605181735`:66 |
| `public.clients` | `trg_sync_client_status_from_stage` | BEFORE INSERT OR UPDATE OF journey_stage_id | `public.sync_client_status_from_journey_stage` | `20260702152057`:47 |
| `public.collaborator_products` | `trg_collaborator_products_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260520153715`:108 |
| `public.commission_splits` | `commission_splits_audit_trg` | AFTER INSERT OR UPDATE OR DELETE | `public.trg_commission_splits_audit` | `20260702212656`:193 |
| `public.commission_splits` | `log_commission_splits_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260508194242`:32 |
| `public.commission_splits` | `trg_cash_capture` | AFTER INSERT OR UPDATE OF status | `private.cash_capture_split` | `20261104120000`:590 |
| `public.commission_splits` | `trg_cash_guard` | BEFORE UPDATE OR DELETE | `private.cash_guard_source` | `20261104120000`:580 |
| `public.commission_splits` | `trg_cash_split_no_auto_paid` | BEFORE INSERT | `private.cash_split_no_auto_paid` | `20261104120000`:374 |
| `public.commission_splits` | `trg_commission_splits_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260507012759`:28 |
| `public.commission_splits` | `trg_splits_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260506154634`:83 |
| `public.commissions` | `commissions_audit_trg` | AFTER INSERT OR UPDATE OR DELETE | `public.trg_commissions_audit` | `20260702212656`:156 |
| `public.commissions` | `log_commissions_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260509215120`:117 |
| `public.commissions` | `tr_sync_commission_split_status` | AFTER UPDATE OF status | `public.sync_commission_split_status` | `20260508185131`:44 |
| `public.commissions` | `trg_cash_capture` | AFTER UPDATE OF status | `private.cash_capture_commission` | `20261104120000`:593 |
| `public.commissions` | `trg_commissions_set_paid_dates` | BEFORE INSERT OR UPDATE OF status | `public.commissions_set_paid_dates` | `20260520012017`:55 |
| `public.commissions` | `trg_commissions_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260428144839`:249 |
| `public.commissions` | `trg_commissions_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260507012759`:24 |
| `public.commissions` | `trg_notify_commission` | AFTER UPDATE | `public.notify_on_commission_status` | `20260507023356`:69 |
| `public.companies` | `update_companies_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260511180553`:83 |
| `public.company_contacts` | `update_company_contacts_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260511180553`:86 |
| `public.contract_folders` | `trg_contract_folders_updated` | BEFORE UPDATE | `public.update_updated_at_column` | `20260701125045`:25 |
| `public.contract_templates` | `trg_contract_templates_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260520153715`:43 |
| `public.contracts` | `log_contracts_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260509215120`:120 |
| `public.contracts` | `tr_on_contract_status_change` | AFTER UPDATE OF status, file_path | `public.on_contract_status_change` | `20260508185717`:82 |
| `public.contracts` | `trg_notify_contract_ins` | AFTER INSERT | `public.notify_on_contract` | `20260507023356`:88 |
| `public.contracts` | `trg_notify_contract_upd` | AFTER UPDATE | `public.notify_on_contract` | `20260507023356`:92 |
| `public.contracts` | `update_contracts_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260506231554`:59 |
| `public.daily_actions` | `update_daily_actions_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260514202739`:47 |
| `public.demand_comments` | `log_comments_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260509215120`:94 |
| `public.demand_comments` | `trg_log_demand_comment` | AFTER INSERT | `public.log_demand_comment` | `20260630225347`:100 |
| `public.demand_comments` | `trg_notify_demand_comment_all` | AFTER INSERT | `public.notify_demand_comment_all` | `20260701140044`:80 |
| `public.demand_comments` | `trg_notify_demand_comment_mentions` | AFTER INSERT | `public.notify_demand_comment_mentions` | `20260510051050`:48 |
| `public.demand_comments` | `update_demand_comments_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260509212745`:78 |
| `public.demand_deliveries` | `trg_log_demand_delivery` | AFTER INSERT | `public.log_demand_delivery` | `20260630225347`:150 |
| `public.demand_deliveries` | `trg_notify_client_delivery` | AFTER INSERT | `public.notify_client_on_new_delivery` | `20260703212039`:65 |
| `public.demand_deliveries` | `update_demand_deliveries_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260511180553`:89 |
| `public.demand_request_messages` | `trg_notify_demand_request_message` | AFTER INSERT | `public.notify_demand_request_message` | `20260701140702`:127 |
| `public.demand_requests` | `trg_demand_requests_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260626052438`:47 |
| `public.demand_requests` | `trg_fill_demand_request_client` | BEFORE INSERT OR UPDATE | `public.fill_demand_request_client` | `20260626052438`:42 |
| `public.demand_requests` | `trg_log_demand_request` | AFTER INSERT | `public.log_demand_request` | `20260630225347`:127 |
| `public.demand_requests` | `trg_notify_demand_request` | AFTER INSERT OR UPDATE | `public.notify_demand_request` | `20260626052438`:133 |
| `public.demand_shares` | `set_demand_shares_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260626051143`:116 |
| `public.document_requests` | `log_doc_requests_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260507002543`:15 |
| `public.document_requests` | `trigger_notify_on_document_request_change` | AFTER UPDATE | `public.notify_on_document_request_change` | `20260508184443`:62 |
| `public.document_requests` | `update_document_requests_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260506192802`:54 |
| `public.document_shares` | `trg_notify_provider_document_share` | AFTER INSERT | `public.notify_provider_on_document_share` | `drizzle 0000`:73 |
| `public.documents` | `log_documents_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260509215120`:111 |
| `public.documents` | `trg_documents_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260428144839`:250 |
| `public.documents` | `trg_enforce_demand_link_on_documents` | BEFORE INSERT OR UPDATE OF client_product_id, client_id, product_id | `public.enforce_demand_link_on_documents` | `20260521134042`:318 |
| `public.documents` | `trg_log_demand_document` | AFTER INSERT OR UPDATE | `public.log_demand_document_event` | `20260630225347`:182 |
| `public.documents` | `trg_notify_document` | AFTER INSERT | `public.notify_on_document` | `20260507023356`:128 |
| `public.documents` | `trg_notify_document_recipient` | AFTER INSERT | `public.notify_document_recipient` | `20260605164148`:126 |
| `public.documents` | `trg_notify_provider_client_doc` | AFTER INSERT | `public.notify_provider_on_client_document_upload` | `20260703212039`:43 |
| `public.employees` | `update_employees_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260506230414`:56 |
| `public.expenses` | `trg_cash_capture` | AFTER INSERT OR UPDATE OF paid, paid_at | `private.cash_capture_expense` | `20261104120000`:587 |
| `public.expenses` | `trg_cash_guard` | BEFORE UPDATE OR DELETE | `private.cash_guard_source` | `20261104120000`:577 |
| `public.expenses` | `trg_expenses_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260702133635`:27 |
| `public.leads` | `log_leads_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260507002225`:46 |
| `public.leads` | `trg_leads_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260507012759`:32 |
| `public.leads` | `trg_log_lead_change` | AFTER INSERT OR UPDATE | `public.log_lead_change` | `20260520012017`:92 |
| `public.leads` | `trg_notify_lead` | AFTER INSERT | `public.notify_on_lead` | `20260507023356`:50 |
| `public.leads` | `update_leads_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260506221520`:36 |
| `public.message_templates` | `trg_templates_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260508183232`:17 |
| `public.notification_preferences` | `trg_notification_preferences_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260701140044`:24 |
| `public.partner_contracts` | `trg_enforce_partner_contract_field_scope` | BEFORE UPDATE | `public.enforce_partner_contract_field_scope` | `20260707013606`:66 |
| `public.partner_contracts` | `trg_notify_partner_contract_signed` | AFTER UPDATE OF status | `public.notify_partner_on_contract_signed` | `20260703212039`:121 |
| `public.partner_contracts` | `update_partner_contracts_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260610215354`:122 |
| `public.partner_documents` | `trg_partner_documents_updated` | BEFORE UPDATE | `public.update_updated_at_column` | `20260703215352`:47 |
| `public.partner_materials` | `trg_notify_partners_new_material` | AFTER INSERT | `public.notify_partners_on_new_material` | `20260703212039`:101 |
| `public.partner_materials` | `update_partner_materials_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260610215354`:117 |
| `public.partner_products` | `trg_partner_products_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260428160605`:40 |
| `public.partner_support_ticket_messages` | `trg_notify_admins_partner_support_msg` | AFTER INSERT | `public.notify_admins_on_partner_support_message` | `20260703211047`:40 |
| `public.partner_support_ticket_messages` | `trg_notify_admins_partner_ticket_msg` | AFTER INSERT | `public.notify_admins_on_partner_ticket_message` | `20260701003443`:43 |
| `public.partner_support_ticket_messages` | `trg_notify_partner_admin_reply` | AFTER INSERT | `public.notify_partner_on_admin_ticket_reply` | `20260703212039`:84 |
| `public.partner_support_tickets` | `trg_notify_admins_new_partner_ticket` | AFTER INSERT | `public.notify_admins_on_new_partner_ticket` | `20260703211047`:71 |
| `public.partner_support_tickets` | `trg_partner_ticket_notify` | AFTER INSERT | `public.notify_on_partner_ticket` | `20260630191752`:70 |
| `public.partner_support_tickets` | `trg_partner_tickets_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260630191752`:45 |
| `public.partners` | `log_partners_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260508193929`:47 |
| `public.partners` | `trg_partners_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260428144839`:246 |
| `public.partners` | `trg_partners_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260507012759`:16 |
| `public.partners` | `trg_prevent_partner_self_privilege_change` | BEFORE UPDATE | `public.prevent_partner_self_privilege_change` | `20260626071425`:24 |
| `public.payments` | `log_payments_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260509215120`:114 |
| `public.payments` | `on_payment_updated` | AFTER UPDATE | `public.handle_payment_update` | `20260518093104`:72 |
| `public.payments` | `payments_audit_trg` | AFTER INSERT OR UPDATE OR DELETE | `public.trg_payments_audit` | `20260702212656`:102 |
| `public.payments` | `trg_cash_capture` | AFTER INSERT OR UPDATE OF status, amount_paid, paid_at | `private.cash_capture_payment` | `20261104120000`:584 |
| `public.payments` | `trg_cash_guard` | BEFORE UPDATE OR DELETE | `private.cash_guard_source` | `20261104120000`:574 |
| `public.payments` | `trg_credit_project_pool` | AFTER INSERT OR UPDATE OF paid_at | `public.credit_project_pool_on_payment` | `20260626070729`:63 |
| `public.payments` | `trg_fill_payment_links_from_sale` | BEFORE INSERT OR UPDATE OF sale_id, client_id, partner_id, referrer_id, collaborator_id | `public.fill_payment_links_from_sale` | `20260521134042`:494 |
| `public.payments` | `trg_goals_on_payment` | AFTER INSERT OR UPDATE OF status, amount, amount_paid, paid_at, due_date, competence_month OR DELETE | `public.trg_recompute_goals_current_month` | `20261103260000`:300 |
| `public.payments` | `trg_payments_provisions_del` | AFTER DELETE | `private.provisions_from_changed_rows` | `20261103240000`:418 |
| `public.payments` | `trg_payments_provisions_ins` | AFTER INSERT | `private.provisions_from_changed_rows` | `20261103240000`:412 |
| `public.payments` | `trg_payments_provisions_upd` | AFTER UPDATE | `private.provisions_from_changed_rows` | `20261103240000`:415 |
| `public.payments` | `trg_payments_release_commission` | AFTER INSERT OR UPDATE OF status, amount, amount_paid, paid_at, sale_id OR DELETE | `public.maybe_release_commission` | `20261103240000`:271 |
| `public.payments` | `trg_payments_sync_splits` | AFTER INSERT OR UPDATE | `public.trg_payments_sync_splits` | `20260704093814`:142 |
| `public.payments` | `update_payments_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260506231554`:60 |
| `public.product_document_files` | `trg_force_owner_uploaded_by_files` | BEFORE INSERT | `public.force_owner_uploaded_by` | `20260707014228`:73 |
| `public.product_document_files` | `trg_lock_uploaded_by_files` | BEFORE UPDATE | `public.lock_uploaded_by_column` | `20260707014228`:112 |
| `public.product_document_folders` | `trg_force_owner_created_by_folders` | BEFORE INSERT | `public.force_owner_created_by` | `20260707014228`:68 |
| `public.product_document_folders` | `trg_lock_created_by_folders` | BEFORE UPDATE | `public.lock_created_by_column` | `20260707014228`:107 |
| `public.product_document_folders` | `trg_pdf_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260701130430`:47 |
| `public.products` | `trg_products_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260428144839`:245 |
| `public.profiles` | `trg_ensure_default_role_on_profile` | AFTER INSERT | `public.ensure_default_role_on_profile` | `20260521135007`:49 |
| `public.profiles` | `trg_profiles_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260428144839`:244 |
| `public.profit_reserves` | `trg_profit_reserves_updated_at` | BEFORE UPDATE | `public.update_profit_reserves_updated_at` | `20260702144834`:37 |
| `public.projects` | `update_projects_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260428152947`:56 |
| `public.proposals` | `trg_proposals_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260510052557`:69 |
| `public.provider_interactions` | `trg_prov_inter_upd` | BEFORE UPDATE | `public.update_updated_at_column` | `20260518082617`:28 |
| `public.provider_schedule` | `trg_prov_sched_upd` | BEFORE UPDATE | `public.update_updated_at_column` | `20260518082617`:59 |
| `public.referrers` | `trg_referrers_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260506154634`:26 |
| `public.referrers` | `trg_referrers_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260507012759`:20 |
| `public.resource_pool_movements` | `trg_apply_pool_movement` | AFTER INSERT OR DELETE | `public.apply_pool_movement` | `20260626051143`:96 |
| `public.resource_pools` | `set_resource_pools_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260626051143`:60 |
| `public.sale_deductions` | `trg_sale_deductions_provisions_del` | AFTER DELETE | `private.provisions_from_changed_rows` | `20261103240000`:428 |
| `public.sale_deductions` | `trg_sale_deductions_provisions_ins` | AFTER INSERT | `private.provisions_from_changed_rows` | `20261103240000`:422 |
| `public.sale_deductions` | `trg_sale_deductions_provisions_upd` | AFTER UPDATE | `private.provisions_from_changed_rows` | `20261103240000`:425 |
| `public.sale_deductions` | `trg_sale_deductions_sync_del` | AFTER DELETE | `private.sale_deductions_sync_sale` | `20261103220000`:199 |
| `public.sale_deductions` | `trg_sale_deductions_sync_ins` | AFTER INSERT | `private.sale_deductions_sync_sale` | `20261103220000`:189 |
| `public.sale_deductions` | `trg_sale_deductions_sync_upd` | AFTER UPDATE | `private.sale_deductions_sync_sale` | `20261103220000`:194 |
| `public.sales` | `log_sales_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260508193929`:44 |
| `public.sales` | `on_sale_created` | AFTER INSERT OR UPDATE OF status, amount, zenon_cost, provider_cost, partner_id, referrer_id, collaborator_id, service_provider_id, commission_percent, referrer_percent, collaborator_percent, deduction_model | `public.handle_new_sale` | `20261103250000`:391 |
| `public.sales` | `on_sale_created_splits` | AFTER INSERT OR UPDATE OF status, amount, zenon_cost, provider_cost, partner_id, referrer_id, collaborator_id, service_provider_id, commission_percent, referrer_percent, collaborator_percent, deduction_model | `public.handle_sale_splits` | `20261103250000`:397 |
| `public.sales` | `on_sale_zz_recompute_release` | AFTER INSERT OR UPDATE OF status, amount, zenon_cost, provider_cost, partner_id, referrer_id, collaborator_id, service_provider_id, commission_percent, referrer_percent, collaborator_percent, revenue_type, recurrence_months, deduction_model | `private.sales_recompute_release` | `20261103250000`:403 |
| `public.sales` | `trg_fill_sale_links_from_client` | BEFORE INSERT OR UPDATE OF client_id, partner_id, referrer_id, collaborator_id | `public.fill_sale_links_from_client` | `20260521134042`:91 |
| `public.sales` | `trg_goals_on_sale` | AFTER INSERT OR UPDATE OR DELETE | `public.trg_recompute_goals_current_month` | `20260701150904`:85 |
| `public.sales` | `trg_mark_client_closed` | AFTER INSERT OR UPDATE OF status | `public.mark_client_closed_on_sale_finalized` | `20260626061407`:16 |
| `public.sales` | `trg_notify_sale` | AFTER INSERT | `public.notify_on_sale` | `20260507023356`:33 |
| `public.sales` | `trg_sales_apply_deductions` | BEFORE UPDATE | `private.sales_apply_deductions` | `20261103220000`:163 |
| `public.sales` | `trg_sales_closed_at` | BEFORE INSERT OR UPDATE OF status | `public.sales_set_closed_at` | `20260626053345`:30 |
| `public.sales` | `trg_sales_mark_conversion` | BEFORE UPDATE OF deduction_model | `private.sales_mark_conversion` | `20261103250000`:385 |
| `public.sales` | `trg_sales_regenerate_provisions` | AFTER UPDATE OF status, amount, deduction_model | `private.sales_regenerate_provisions` | `20261103240000`:445 |
| `public.sales` | `trg_sales_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260428144839`:248 |
| `public.sales` | `trg_sales_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260507012759`:36 |
| `public.sales` | `trg_set_sale_stage_snapshot` | BEFORE INSERT OR UPDATE OF status, client_id | `public.set_sale_stage_snapshot` | `20260706160017`:22 |
| `public.sales` | `trg_sync_sale_financial_schedule` | AFTER INSERT OR UPDATE OF status | `public.sync_sale_financial_schedule` | `20261103260000`:117 |
| `public.sales` | `trg_sync_sale_to_client_product_ins` | AFTER INSERT | `public.sync_sale_to_client_product` | `20260520021818`:63 |
| `public.sales` | `trg_sync_sale_to_client_product_upd` | AFTER UPDATE | `public.sync_sale_to_client_product` | `20260520021818`:69 |
| `public.sales_goals` | `set_sales_goals_updated_at` | BEFORE UPDATE | `public.set_updated_at` | `20260626051143`:38 |
| `public.service_assignments` | `log_assignments_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260509215120`:99 |
| `public.service_assignments` | `tr_service_assignments_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260506194127`:87 |
| `public.service_provider_products` | `trg_service_provider_products_updated` | BEFORE UPDATE | `public.set_updated_at` | `20260520153715`:79 |
| `public.service_providers` | `tr_service_providers_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260506194127`:82 |
| `public.service_providers` | `update_service_providers_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260506230414`:61 |
| `public.signature_stages` | `trg_sig_stages_updated` | BEFORE UPDATE | `public.update_updated_at_column` | `20260703204434`:70 |
| `public.support_ticket_messages` | `trg_on_support_message` | AFTER INSERT | `public.on_support_message` | `drizzle 0000`:139 |
| `public.task_checklist_items` | `trg_task_checklist_items_updated_at` | BEFORE UPDATE | `public.update_updated_at_column` | `20260518103022`:28 |
| `public.task_comments` | `trg_notify_task_comment` | AFTER INSERT | `public.notify_assignee_on_task_comment` | `20260703212039`:174 |
| `public.tasks` | `log_tasks_activity` | AFTER INSERT OR UPDATE OR DELETE | `public.log_activity` | `20260507002225`:49 |
| `public.tasks` | `trg_fill_task_assigned_from_demand` | BEFORE INSERT | `public.fill_task_assigned_from_demand` | `20260521014656`:130 |
| `public.tasks` | `trg_notify_task_ins` | AFTER INSERT | `public.notify_on_task_assign` | `20260507023356`:107 |
| `public.tasks` | `trg_notify_task_upd` | AFTER UPDATE | `public.notify_on_task_assign` | `20260507023356`:111 |
| `public.tasks` | `trg_sync_task_status_legacy` | BEFORE INSERT OR UPDATE | `public.sync_task_status_legacy` | `20260521135007`:26 |
