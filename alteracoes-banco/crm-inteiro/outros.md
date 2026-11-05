# Views, tipos, índices e demais objetos

## Views

| View | Materializada | Migration |
|---|---|---|
| `public.v_commission_overpayments` | não | `20261103250000`:411 |
| `public.v_commissions_unified` | não | `20260520020202`:125 |
| `public.view_client_financial_summary` | não | `20261103210000`:281 |
| `public.view_performance_by_product` | não | `20260508185131`:2 |
| `public.view_performance_by_source` | não | `20260508185131`:15 |

## Tipos enum

| Tipo | Valores |
|---|---|
| `public.app_role` | admin, vendedor, parceiro, cliente, colaborador, prestador, admin_secondary, lead, indicador, super_admin |
| `public.beneficiary_type` | partner, referrer, collaborator, service_provider |
| `public.billing_cycle` | mensal, trimestral, semestral, anual, unico |
| `public.client_status` | ativo, inativo, prospecto, novo_cliente, aguardando_atendimento, aguardando_documentos, documentos_enviados, documentos_analise, documentos_aprovados, documentos_reprovados, aguardando_contrato, contrato_enviado, contrato_assinado, pagamento_pendente, pagamento_parcial, pagamento_confirmado, em_andamento, aguardando_terceiro, finalizado, cancelado, reembolso |
| `public.comment_visibility` | internal, provider, client, system, admin |
| `public.commission_status` | pendente, pago, cancelado |
| `public.commission_status_enum` | gerada, em_analise, aprovada, paga, cancelada, bloqueada |
| `public.commission_workflow_status` | aguardando_confirmacao, pendente, liberada, em_pagamento, paga, cancelada, estornada |
| `public.contract_status` | criado, enviado, aguardando_assinatura, assinado, pendente_correcao, cancelado, finalizado, rascunho, vencido |
| `public.demand_priority` | baixa, normal, alta, urgente |
| `public.document_status` | solicitado, enviado, aprovado, rejeitado |
| `public.document_status_new` | solicitado, enviado, em_analise, aprovado, reprovado, pendente_correcao, vencido |
| `public.partner_type` | parceiro, indicador |
| `public.partner_type_enum` | indicador, afiliado, consultoria, agencia, outro |
| `public.payment_status` | pago, pendente, parcialmente_pago, atrasado, cancelado, reembolsado, parcial, vencido, em_aberto |
| `public.project_status` | previsto, ativo, em_andamento, concluido, cancelado |
| `public.sale_status` | pendente, em_andamento, concluida, cancelada |
| `public.split_status` | pendente, pago, cancelado |
| `public.step_status` | pendente, em_andamento, bloqueado, concluido, cancelado |
| `public.subscription_status` | ativa, pausada, cancelada, inadimplente |
| `public.task_kind` | tarefa, reuniao, ligacao, pendencia_documento, lembrete, follow_up |
| `public.task_priority_new` | baixa, normal, alta, urgente |
| `public.task_status_new` | a_fazer, em_andamento, aguardando_terceiros, bloqueada, concluida, cancelada, sem_atuacao |

## Pastas de arquivos (Storage)

| Pasta | Criada em migration | Usada no código |
|---|---|---|
| `documents` | sim, `20260506231326` | sim |
| `contracts` | sim, `20260508185417` | sim |
| `partner-materials` | **não** | sim |
| `partner-contracts` | **não** | sim |
| `expense-receipts` | **não** | sim |
| `product-documents` | **não** | sim |
| `signature-stages` | **não** | sim |

## Tempo real

Tabelas publicadas em `supabase_realtime` pelas migrations:

- `public.client_timeline`
- `public.clients`
- `public.commission_splits`
- `public.commissions`
- `public.expenses`
- `public.leads`
- `public.notifications`
- `public.payments`
- `public.proposals`
- `public.sale_deductions`
- `public.sales`
- `public.sales_goals`

## Extensões

- `pg_trgm`

## Edge functions

| Função | `verify_jwt` | Chamada por | Confere usuário no código |
|---|---|---|---|
| `ai-assistant` | false | components/chat/AIAssistant.tsx | sim, `getUser` |
| `invite-user` | true | components/clients/ClientFormDialog.tsx, components/CredentialsManager.tsx, components/provider/ProviderFormDialog.tsx, pages/Collaborators.tsx +2 | sim, `getUser` e papel em `user_roles` |
| `process-alerts` | false | pages/FinanceCenter.tsx | sim, `getUser` e papel em `user_roles` |

Segredos lidos pelas edge functions (só os nomes): `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

## Índices

| Índice | Tabela | Único | Migration |
|---|---|---|---|
| `idx_activity_logs_created_at_desc` | `public.activity_logs` | não | `20260609004557` |
| `idx_activity_logs_user_created` | `public.activity_logs` | não | `20260630210628` |
| `idx_audit_logs_created_at` | `public.audit_logs` | não | `20260629103052` |
| `idx_audit_logs_entity` | `public.audit_logs` | não | `20260629103052` |
| `idx_audit_logs_user_id` | `public.audit_logs` | não | `20260629103052` |
| `cash_accounts_one_default` | `public.cash_accounts` | sim | `20261104120000` |
| `cash_settlements_date_idx` | `public.cash_settlements` | não | `20261104120000` |
| `cash_settlements_historic_once` | `public.cash_settlements` | sim | `20261104120000` |
| `cash_settlements_source_idx` | `public.cash_settlements` | não | `20261104120000` |
| `idx_chat_messages_created_desc` | `public.chat_messages` | não | `20260630210628` |
| `idx_chat_recipient` | `public.chat_messages` | não | `20260508183232` |
| `idx_chat_sender` | `public.chat_messages` | não | `20260508183232` |
| `idx_client_collaborators_client_collaborator` | `public.client_collaborators` | não | `20260630222102` |
| `idx_cdfp_provider` | `public.client_document_folder_providers` | não | `20260701124414` |
| `idx_cdf_client` | `public.client_document_folders` | não | `20260701124414` |
| `idx_cdr_client_product` | `public.client_document_requests` | não | `20260509221214` |
| `idx_client_document_requests_file_url` | `public.client_document_requests` | não | `20260610215354` |
| `idx_client_document_requests_file_url_cp` | `public.client_document_requests` | não | `20260630222102` |
| `idx_client_interactions_client` | `public.client_interactions` | não | `20260518212444` |
| `idx_client_interactions_kind_occurred` | `public.client_interactions` | não | `20260707002902` |
| `idx_client_interactions_next_action` | `public.client_interactions` | não | `20260518212444` |
| `idx_client_interactions_occurred` | `public.client_interactions` | não | `20260518212444` |
| `idx_client_partners_client_partner` | `public.client_partners` | não | `20260630222102` |
| `idx_client_product_providers_product_provider` | `public.client_product_providers` | não | `20260629044140` |
| `idx_client_product_providers_provider_product` | `public.client_product_providers` | não | `20260629044140` |
| `idx_cpp_demand` | `public.client_product_providers` | não | `20260605165827` |
| `idx_cpp_provider` | `public.client_product_providers` | não | `20260605165827` |
| `idx_client_product_reports_created_desc` | `public.client_product_status_reports` | não | `20260629044140` |
| `idx_client_product_reports_product_created_desc` | `public.client_product_status_reports` | não | `20260629044140` |
| `idx_cpsr_client_product` | `public.client_product_status_reports` | não | `20260508192322` |
| `idx_cpsr_created_at` | `public.client_product_status_reports` | não | `20260508192322` |
| `idx_cpsr_product_created` | `public.client_product_status_reports` | não | `20260607064433` |
| `idx_client_product_steps_cp_id` | `public.client_product_steps` | não | `20260629103052` |
| `idx_client_product_steps_product_position` | `public.client_product_steps` | não | `20260607064433` |
| `idx_client_product_steps_visible_product` | `public.client_product_steps` | não | `20260607064433` |
| `client_products_sale_id_uniq` | `public.client_products` | sim | `20260520021818` |
| `idx_client_products_client_id` | `public.client_products` | não | `20260629103052` |
| `idx_client_products_client_product_sale_null` | `public.client_products` | não | `20260521014656` |
| `idx_client_products_created_at` | `public.client_products` | não | `20260629103052` |
| `idx_client_products_deadline` | `public.client_products` | não | `20260629044140` |
| `idx_client_products_end_date` | `public.client_products` | não | `20260629044140` |
| `idx_client_products_id_client_id` | `public.client_products` | não | `20260630222102` |
| `idx_client_products_priority` | `public.client_products` | não | `20260509212222` |
| `idx_client_products_product_id` | `public.client_products` | não | `20260629103052` |
| `idx_client_products_responsible_employee_id` | `public.client_products` | não | `20260629103052` |
| `idx_client_products_responsible_provider_id` | `public.client_products` | não | `20260519105209` |
| `idx_client_products_service_provider_id` | `public.client_products` | não | `20260629103052` |
| `idx_client_products_sla_due_date` | `public.client_products` | não | `20260629044140` |
| `idx_client_products_status` | `public.client_products` | não | `20260509212222` |
| `idx_client_products_status_created_desc` | `public.client_products` | não | `20260629044140` |
| `idx_client_products_status_provider` | `public.client_products` | não | `20260629044140` |
| `idx_client_products_updated_at_desc` | `public.client_products` | não | `20260629044140` |
| `idx_client_providers_client_provider` | `public.client_providers` | não | `20260630222102` |
| `idx_client_providers_provider_client` | `public.client_providers` | não | `20260629044140` |
| `idx_client_referrers_client_referrer` | `public.client_referrers` | não | `20260630222102` |
| `idx_stage_history_client_at` | `public.client_stage_history` | não | `20260702152910` |
| `idx_subs_client` | `public.client_subscriptions` | não | `20260506154634` |
| `idx_subs_next` | `public.client_subscriptions` | não | `20260506154634` |
| `idx_subs_status` | `public.client_subscriptions` | não | `20260506154634` |
| `ix_cstm_ticket` | `public.client_support_ticket_messages` | não | `20260701002113` |
| `ix_cst_assigned` | `public.client_support_tickets` | não | `20260701002113` |
| `ix_cst_client` | `public.client_support_tickets` | não | `20260701002113` |
| `ix_cst_status` | `public.client_support_tickets` | não | `20260701002113` |
| `idx_timeline_client` | `public.client_timeline` | não | `20260428150955` |
| `clients_document_unique_idx` | `public.clients` | sim | `20260519120737` |
| `idx_clients_city` | `public.clients` | não | `20260629044140` |
| `idx_clients_collaborator_id` | `public.clients` | não | `20260519105847` |
| `idx_clients_created_at` | `public.clients` | não | `20260629103052` |
| `idx_clients_created_at_desc` | `public.clients` | não | `20260629044140` |
| `idx_clients_document` | `public.clients` | não | `20260519121917` |
| `idx_clients_email` | `public.clients` | não | `20260519121917` |
| `idx_clients_full_name` | `public.clients` | não | `20260508030153` |
| `idx_clients_id_user_id` | `public.clients` | não | `20260630222102` |
| `idx_clients_partner_created` | `public.clients` | não | `20260610215354` |
| `idx_clients_partner_id` | `public.clients` | não | `20260629103052` |
| `idx_clients_referrer_id` | `public.clients` | não | `20260629103052` |
| `idx_clients_responsible_id` | `public.clients` | não | `20260629103052` |
| `idx_clients_search` | `public.clients` | não | `20260428150955` |
| `idx_clients_service_provider_id` | `public.clients` | não | `20260629044140` |
| `idx_clients_status_created` | `public.clients` | não | `20260610215354` |
| `idx_clients_updated_status` | `public.clients` | não | `20260629044140` |
| `idx_clients_user_id` | `public.clients` | não | `20260629103052` |
| `commission_audit_log_beneficiary_idx` | `public.commission_audit_log` | não | `20260702212656` |
| `commission_audit_log_sale_idx` | `public.commission_audit_log` | não | `20260702212656` |
| `commission_audit_log_source_idx` | `public.commission_audit_log` | não | `20260702212656` |
| `commission_rules_unique_combo` | `public.commission_rules` | sim | `20260520012017` |
| `idx_commission_splits_beneficiary` | `public.commission_splits` | não | `20260610215354` |
| `idx_commission_splits_client_id` | `public.commission_splits` | não | `20260704093814` |
| `idx_commission_splits_created_at_desc` | `public.commission_splits` | não | `20260609004557` |
| `idx_commission_splits_payment_id` | `public.commission_splits` | não | `20260704093814` |
| `idx_commission_splits_sale_id` | `public.commission_splits` | não | `20260610215354` |
| `idx_commission_splits_status` | `public.commission_splits` | não | `20260607055636` |
| `idx_splits_beneficiary` | `public.commission_splits` | não | `20260506154634` |
| `idx_splits_sale` | `public.commission_splits` | não | `20260506154634` |
| `commissions_service_provider_id_idx` | `public.commissions` | não | `20260701001044` |
| `idx_commissions_client` | `public.commissions` | não | `20260506221746` |
| `idx_commissions_client_id` | `public.commissions` | não | `20260519121917` |
| `idx_commissions_client_product` | `public.commissions` | não | `20260509221214` |
| `idx_commissions_client_product_id` | `public.commissions` | não | `20260519120737` |
| `idx_commissions_created_at_desc` | `public.commissions` | não | `20260609004557` |
| `idx_commissions_partner_id` | `public.commissions` | não | `20260508030153` |
| `idx_commissions_partner_status` | `public.commissions` | não | `20260506221746` |
| `idx_commissions_payment_id` | `public.commissions` | não | `20260702210531` |
| `idx_commissions_sale_id` | `public.commissions` | não | `20260520013155` |
| `idx_commissions_status` | `public.commissions` | não | `20260508030153` |
| `idx_commissions_status_partner` | `public.commissions` | não | `20260520013155` |
| `idx_commissions_workflow_created_desc` | `public.commissions` | não | `20260629044140` |
| `idx_contracts_client_id` | `public.contracts` | não | `20260629044140` |
| `idx_contracts_client_product` | `public.contracts` | não | `20260509221214` |
| `idx_contracts_client_product_id` | `public.contracts` | não | `20260519105209` |
| `idx_contracts_created_at` | `public.contracts` | não | `20260607055636` |
| `idx_contracts_folder_id` | `public.contracts` | não | `20260701125045` |
| `idx_contracts_partner_id` | `public.contracts` | não | `20260519105209` |
| `idx_contracts_provider_id` | `public.contracts` | não | `20260519105209` |
| `idx_contracts_sale_id` | `public.contracts` | não | `20260519105209` |
| `idx_contracts_status_created_desc` | `public.contracts` | não | `20260629044140` |
| `idx_daily_actions_assigned_to` | `public.daily_actions` | não | `20260514202739` |
| `idx_daily_actions_client_id` | `public.daily_actions` | não | `20260514202739` |
| `idx_daily_actions_scheduled_date` | `public.daily_actions` | não | `20260514202739` |
| `idx_daily_actions_status` | `public.daily_actions` | não | `20260514202739` |
| `idx_demand_comments_client_product_id` | `public.demand_comments` | não | `20260509212745` |
| `idx_demand_comments_visibility` | `public.demand_comments` | não | `20260509212745` |
| `idx_demand_deliveries_client_product_created_desc` | `public.demand_deliveries` | não | `20260629044140` |
| `idx_demand_deliveries_created_desc` | `public.demand_deliveries` | não | `20260629044140` |
| `idx_demand_deliveries_file_url` | `public.demand_deliveries` | não | `20260610215354` |
| `idx_demand_deliveries_file_url_cp` | `public.demand_deliveries` | não | `20260630222102` |
| `idx_demand_deliveries_provider_status` | `public.demand_deliveries` | não | `20260629044140` |
| `idx_demand_request_messages_request` | `public.demand_request_messages` | não | `20260701123649` |
| `idx_demand_shares_client_product_id` | `public.demand_shares` | não | `20260630210628` |
| `idx_demand_shares_provider_id` | `public.demand_shares` | não | `20260630210628` |
| `idx_document_requests_client_created_desc` | `public.document_requests` | não | `20260629044140` |
| `idx_document_requests_client_product` | `public.document_requests` | não | `20260508192322` |
| `idx_document_requests_collaborator_id` | `public.document_requests` | não | `20260526172633` |
| `idx_document_requests_provider_id` | `public.document_requests` | não | `20260526172633` |
| `idx_document_requests_provider_status` | `public.document_requests` | não | `20260629044140` |
| `idx_document_requests_status_requested_desc` | `public.document_requests` | não | `20260629044140` |
| `idx_document_shares_document` | `public.document_shares` | não | `20261024160000` |
| `idx_document_shares_provider` | `public.document_shares` | não | `20261024160000` |
| `idx_document_versions_doc` | `public.document_versions` | não | `20260518094800` |
| `documents_parent_document_id_idx` | `public.documents` | não | `20260702204700` |
| `idx_documents_client_created_desc` | `public.documents` | não | `20260629044140` |
| `idx_documents_client_id` | `public.documents` | não | `20260629103052` |
| `idx_documents_client_product` | `public.documents` | não | `20260508192322` |
| `idx_documents_client_product_created_desc` | `public.documents` | não | `20260629044140` |
| `idx_documents_client_product_id` | `public.documents` | não | `20260629103052` |
| `idx_documents_collaborator_id` | `public.documents` | não | `20260526172633` |
| `idx_documents_created_at` | `public.documents` | não | `20260607055636` |
| `idx_documents_created_status` | `public.documents` | não | `20260609004557` |
| `idx_documents_due_date` | `public.documents` | não | `20260629044140` |
| `idx_documents_file_path` | `public.documents` | não | `20261024160000` |
| `idx_documents_folder` | `public.documents` | não | `20260701124414` |
| `idx_documents_is_required` | `public.documents` | não | `20260509212512` |
| `idx_documents_partner_file_path` | `public.documents` | não | `20260630222102` |
| `idx_documents_partner_id` | `public.documents` | não | `20260630211354` |
| `idx_documents_product_id` | `public.documents` | não | `20260509212512` |
| `idx_documents_provider_id` | `public.documents` | não | `20260526172633` |
| `idx_documents_status` | `public.documents` | não | `20260509212512` |
| `idx_documents_status_created_desc` | `public.documents` | não | `20260629044140` |
| `idx_employees_email` | `public.employees` | não | `20260506230414` |
| `idx_employees_user_id` | `public.employees` | não | `20260607060027` |
| `expenses_sale_id_idx` | `public.expenses` | não | `20261103240000` |
| `idx_expenses_created_by` | `public.expenses` | não | `20260607055636` |
| `idx_expenses_expense_date` | `public.expenses` | não | `20260607055636` |
| `idx_expenses_paid` | `public.expenses` | não | `20260702133635` |
| `idx_expenses_reference_month` | `public.expenses` | não | `20260702133635` |
| `idx_financial_alerts_is_read` | `public.financial_alerts` | não | `20260509213159` |
| `idx_financial_alerts_type` | `public.financial_alerts` | não | `20260509213159` |
| `idx_leads_created_at` | `public.leads` | não | `20260607055636` |
| `idx_leads_created_desc` | `public.leads` | não | `20260629044140` |
| `idx_leads_email` | `public.leads` | não | `20260519121917` |
| `idx_leads_full_name` | `public.leads` | não | `20260508030153` |
| `idx_leads_partner_id` | `public.leads` | não | `20260629044140` |
| `idx_leads_responsible_id` | `public.leads` | não | `20260629044140` |
| `idx_leads_status` | `public.leads` | não | `20260607055636` |
| `idx_notes_client_product` | `public.notes` | não | `20260509221214` |
| `idx_notifications_user_created_at_desc` | `public.notifications` | não | `20260609004729` |
| `idx_notifications_user_id` | `public.notifications` | não | `20260607060027` |
| `idx_notifications_user_read_created` | `public.notifications` | não | `20260630210628` |
| `idx_notifications_user_unread` | `public.notifications` | não | `20260609004729` |
| `idx_partner_contracts_contract_signed_path` | `public.partner_contracts` | não | `20260630222102` |
| `idx_partner_contracts_contract_template_path` | `public.partner_contracts` | não | `20260630222102` |
| `idx_partner_contracts_files` | `public.partner_contracts` | não | `20260610215354` |
| `idx_partner_contracts_nda_signed_path` | `public.partner_contracts` | não | `20260630222102` |
| `idx_partner_contracts_nda_template_path` | `public.partner_contracts` | não | `20260630222102` |
| `idx_partner_contracts_partner_id` | `public.partner_contracts` | não | `20260610215354` |
| `partner_documents_partner_idx` | `public.partner_documents` | não | `20260703215352` |
| `idx_partner_materials_active_created` | `public.partner_materials` | não | `20260610215354` |
| `idx_partner_materials_audience` | `public.partner_materials` | não | `20260702223604` |
| `idx_partner_materials_file_path_active` | `public.partner_materials` | não | `20260630222102` |
| `idx_partner_products_partner` | `public.partner_products` | não | `20260428160605` |
| `idx_partner_products_product` | `public.partner_products` | não | `20260428160605` |
| `idx_pstm_ticket` | `public.partner_support_ticket_messages` | não | `20260630231914` |
| `idx_partner_support_tickets_partner_id` | `public.partner_support_tickets` | não | `20260630210628` |
| `idx_partner_support_tickets_status_created` | `public.partner_support_tickets` | não | `20260630210628` |
| `idx_pst_assigned_to` | `public.partner_support_tickets` | não | `20260630234838` |
| `idx_pst_status` | `public.partner_support_tickets` | não | `20260630234838` |
| `idx_partners_active_full_name` | `public.partners` | não | `20260629044140` |
| `idx_partners_created_at_desc` | `public.partners` | não | `20260629044140` |
| `idx_partners_email_lower` | `public.partners` | não | `20260629044140` |
| `idx_partners_search` | `public.partners` | não | `20260428150955` |
| `idx_partners_user_id` | `public.partners` | não | `20260607060027` |
| `payment_audit_log_payment_idx` | `public.payment_audit_log` | não | `20260702212656` |
| `payment_audit_log_sale_idx` | `public.payment_audit_log` | não | `20260702212656` |
| `idx_payments_client_due` | `public.payments` | não | `20260610215354` |
| `idx_payments_client_due_desc` | `public.payments` | não | `20260629044140` |
| `idx_payments_client_id` | `public.payments` | não | `20260509213159` |
| `idx_payments_client_id_due_date` | `public.payments` | não | `20260629103052` |
| `idx_payments_client_product_id` | `public.payments` | não | `20260519105209` |
| `idx_payments_collaborator` | `public.payments` | não | `20260520020202` |
| `idx_payments_competence_month` | `public.payments` | não | `20260702152518` |
| `idx_payments_due_date` | `public.payments` | não | `20260607055636` |
| `idx_payments_due_status` | `public.payments` | não | `20260629044140` |
| `idx_payments_paid_at_status` | `public.payments` | não | `20260629044140` |
| `idx_payments_partner` | `public.payments` | não | `20260520020202` |
| `idx_payments_referrer` | `public.payments` | não | `20260520020202` |
| `idx_payments_sale_id` | `public.payments` | não | `20260629103052` |
| `idx_payments_sale_status` | `public.payments` | não | `20260629044140` |
| `idx_payments_status` | `public.payments` | não | `20260607055636` |
| `idx_payments_status_due_date` | `public.payments` | não | `20260609004557` |
| `idx_pdfiles_folder` | `public.product_document_files` | não | `20260701130430` |
| `idx_pdf_owner` | `public.product_document_folders` | não | `20260701130430` |
| `idx_pdf_product` | `public.product_document_folders` | não | `20260701130430` |
| `idx_products_search` | `public.products` | não | `20260428150955` |
| `profiles_email_lower_uidx` | `public.profiles` | sim | `20260520012017` |
| `profiles_email_unique_idx` | `public.profiles` | sim | `20260519120737` |
| `idx_profit_reserves_month` | `public.profit_reserves` | não | `20260702144834` |
| `idx_projects_client` | `public.projects` | não | `20260428152947` |
| `idx_projects_start` | `public.projects` | não | `20260428152947` |
| `idx_projects_status` | `public.projects` | não | `20260428152947` |
| `idx_proposal_items_proposal` | `public.proposal_items` | não | `20260510052557` |
| `idx_proposals_client` | `public.proposals` | não | `20260510052557` |
| `idx_proposals_lead` | `public.proposals` | não | `20260510052557` |
| `idx_prov_inter_client` | `public.provider_interactions` | não | `20260518082617` |
| `idx_prov_inter_occurred` | `public.provider_interactions` | não | `20260518082617` |
| `idx_prov_inter_provider` | `public.provider_interactions` | não | `20260518082617` |
| `idx_prov_sched_client` | `public.provider_schedule` | não | `20260518082617` |
| `idx_prov_sched_provider_date` | `public.provider_schedule` | não | `20260518082617` |
| `idx_prov_sched_status` | `public.provider_schedule` | não | `20260518082617` |
| `idx_referrers_email_lower` | `public.referrers` | não | `20260629044140` |
| `idx_referrers_user_id` | `public.referrers` | não | `20260629044140` |
| `uq_rpm_payment_ref` | `public.resource_pool_movements` | sim | `20260626062456` |
| `idx_resource_pools_project` | `public.resource_pools` | não | `20260626053345` |
| `sale_deductions_sale_id_idx` | `public.sale_deductions` | não | `20261103220000` |
| `idx_sales_client_date` | `public.sales` | não | `20260610215354` |
| `idx_sales_client_id` | `public.sales` | não | `20260629103052` |
| `idx_sales_closed_at` | `public.sales` | não | `20260626053345` |
| `idx_sales_closed_at_revenue_type` | `public.sales` | não | `20260626061407` |
| `idx_sales_closed_revenue` | `public.sales` | não | `20260626062456` |
| `idx_sales_collaborator_id` | `public.sales` | não | `20260519105847` |
| `idx_sales_collaborator_sale_date_desc` | `public.sales` | não | `20260629044140` |
| `idx_sales_created_at` | `public.sales` | não | `20260607055636` |
| `idx_sales_partner_date` | `public.sales` | não | `20260610215354` |
| `idx_sales_partner_id` | `public.sales` | não | `20260629103052` |
| `idx_sales_product_id` | `public.sales` | não | `20260629103052` |
| `idx_sales_product_sale_date_desc` | `public.sales` | não | `20260629044140` |
| `idx_sales_project_id` | `public.sales` | não | `20260626062456` |
| `idx_sales_provider_sale_date_desc` | `public.sales` | não | `20260629044140` |
| `idx_sales_referrer_id` | `public.sales` | não | `20260629103052` |
| `idx_sales_referrer_sale_date_desc` | `public.sales` | não | `20260629044140` |
| `idx_sales_resource_pool_id` | `public.sales` | não | `20260626070729` |
| `idx_sales_revenue_sale_date_desc` | `public.sales` | não | `20260629044140` |
| `idx_sales_revenue_type` | `public.sales` | não | `20260626053345` |
| `idx_sales_sale_date` | `public.sales` | não | `20260629103052` |
| `idx_sales_sale_date_desc` | `public.sales` | não | `20260629044140` |
| `idx_sales_service_provider_id` | `public.sales` | não | `20260610213747` |
| `idx_sales_stage_at_sale` | `public.sales` | não | `20260706160017` |
| `idx_sales_status_sale_date_desc` | `public.sales` | não | `20260629044140` |
| `sales_goals_unique_idx` | `public.sales_goals` | sim | `20260626051143` |
| `idx_service_providers_active_name` | `public.service_providers` | não | `20260629044140` |
| `idx_service_providers_created_at_desc` | `public.service_providers` | não | `20260629044140` |
| `idx_service_providers_document` | `public.service_providers` | não | `20260506230414` |
| `idx_service_providers_email` | `public.service_providers` | não | `20260506230414` |
| `idx_service_providers_email_lower` | `public.service_providers` | não | `20260629044140` |
| `idx_service_providers_user` | `public.service_providers` | não | `20260508192402` |
| `idx_sig_stages_ctr` | `public.signature_stages` | não | `20260703204434` |
| `idx_sig_stages_doc` | `public.signature_stages` | não | `20260703204434` |
| `idx_support_msgs_ticket` | `public.support_ticket_messages` | não | `drizzle 0000` |
| `idx_support_tickets_requester` | `public.support_tickets` | não | `drizzle 0000` |
| `idx_task_checklist_items_task` | `public.task_checklist_items` | não | `20260518103022` |
| `idx_task_comments_task` | `public.task_comments` | não | `20260518103022` |
| `idx_tasks_assigned_status` | `public.tasks` | não | `20260520013155` |
| `idx_tasks_assigned_to` | `public.tasks` | não | `20260629103052` |
| `idx_tasks_assigned_to_due` | `public.tasks` | não | `20260610215354` |
| `idx_tasks_client_id` | `public.tasks` | não | `20260629103052` |
| `idx_tasks_client_product_id` | `public.tasks` | não | `20260629103052` |
| `idx_tasks_contract_id` | `public.tasks` | não | `20260629044140` |
| `idx_tasks_created_at` | `public.tasks` | não | `20260610215354` |
| `idx_tasks_created_at_desc` | `public.tasks` | não | `20260609004557` |
| `idx_tasks_due_client` | `public.tasks` | não | `20260521011908` |
| `idx_tasks_due_date` | `public.tasks` | não | `20260629103052` |
| `idx_tasks_due_status` | `public.tasks` | não | `20260629044140` |
| `idx_tasks_kind` | `public.tasks` | não | `20260521011908` |
| `idx_tasks_partner_id` | `public.tasks` | não | `20260629044140` |
| `idx_tasks_payment_id` | `public.tasks` | não | `20260629044140` |
| `idx_tasks_priority` | `public.tasks` | não | `20260509212834` |
| `idx_tasks_provider_id` | `public.tasks` | não | `20260629044140` |
| `idx_tasks_status` | `public.tasks` | não | `20260607055636` |
| `idx_tasks_status_new_due` | `public.tasks` | não | `20260629044140` |
