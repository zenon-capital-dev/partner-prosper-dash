# Telas e edge functions x banco

O que cada arquivo acessa de forma direta. Serve para saber o que quebra quando algo muda no banco.

| Arquivo | Tabelas | Funções | Pastas | Edge functions |
|---|---|---|---|---|
| `src/components/AppSidebar.tsx` | clients, profiles |  |  |  |
| `src/components/audit/FinancialAuditPanel.tsx` | commission_audit_log, payment_audit_log |  |  |  |
| `src/components/chat/AIAssistant.tsx` |  |  |  | ai-assistant |
| `src/components/chat/InternalChat.tsx` | chat_messages, profiles |  |  |  |
| `src/components/client/ClientContractsTab.tsx` | contract_history, contracts |  | contracts |  |
| `src/components/client/ClientDocumentsTab.tsx` | client_document_requests, document_requests, documents |  |  |  |
| `src/components/client/ClientSupportTab.tsx` | client_support_ticket_messages, client_support_tickets |  |  |  |
| `src/components/client/PaymentReceiptDialog.tsx` | clients, documents, notifications, user_roles | client_submit_payment_receipt |  |  |
| `src/components/clients/AddProductDialog.tsx` | client_products, clients, companies, products, sales |  |  |  |
| `src/components/clients/ClientFichaTabs.tsx` | contracts, notes, payments, sales, tasks |  | contracts |  |
| `src/components/clients/ClientFormDialog.tsx` | client_products, clients, onboarding_documents, system_settings |  |  | invite-user |
| `src/components/clients/ClientJourneyBadge.tsx` | client_journey_stages, client_stage_history, clients |  |  |  |
| `src/components/clients/ClientLinksManager.tsx` | clients, profiles, user_roles |  |  |  |
| `src/components/clients/ClientTimelineTab.tsx` | client_products, client_support_tickets, demand_comments, demand_deliveries, demand_requests, document_requests, payments, profiles, tasks, user_roles |  |  |  |
| `src/components/clients/CompanyContactsManager.tsx` | company_contacts |  |  |  |
| `src/components/clients/CompanyFormDialog.tsx` | companies |  |  |  |
| `src/components/clients/DelegateProviderDialog.tsx` | client_product_providers, client_products |  |  |  |
| `src/components/clients/InlineStageSelect.tsx` | client_journey_stages, clients |  |  |  |
| `src/components/clients/IntelligentSummary.tsx` | client_products, clients, contracts, documents, payments, profiles |  |  |  |
| `src/components/clients/OperationalChecklist.tsx` | client_product_steps, client_products, products |  |  |  |
| `src/components/clients/PauseDemandDialog.tsx` | client_product_pauses |  |  |  |
| `src/components/clients/QualityApprovalDialog.tsx` | client_product_quality_checks, client_products |  |  |  |
| `src/components/clients/RecordDelayDialog.tsx` | client_product_delays, client_products |  |  |  |
| `src/components/clients/StageQuickMenu.tsx` | clients |  |  |  |
| `src/components/clients/tabs/ClientContracts.tsx` | contracts |  | contracts |  |
| `src/components/clients/tabs/ClientDeliveries.tsx` | client_products, demand_deliveries |  | documents |  |
| `src/components/clients/tabs/ClientDocuments.tsx` | client_products, documents |  | documents |  |
| `src/components/clients/tabs/ClientFinancial.tsx` | payments, sales |  | documents |  |
| `src/components/clients/tabs/ClientHistory.tsx` | activity_logs, daily_actions, profiles |  |  |  |
| `src/components/clients/tabs/ClientOnboardingTab.tsx` | clients, onboarding_documents, profiles |  | documents |  |
| `src/components/clients/tabs/ClientOverview.tsx` | profiles, referrers, service_providers |  |  |  |
| `src/components/clients/tabs/ClientProducts.tsx` | client_product_status_reports, client_products, partners, referrers, sales |  |  |  |
| `src/components/clients/tabs/ClientProductSteps.tsx` | client_product_steps |  |  |  |
| `src/components/clients/tabs/ClientTasks.tsx` | profiles, tasks |  |  |  |
| `src/components/commissions/AllBeneficiariesTable.tsx` | commission_splits, v_commissions_unified |  |  |  |
| `src/components/contracts/ContractDialog.tsx` | contracts, sales |  | contracts |  |
| `src/components/contracts/ContractFolders.tsx` | contract_folders, contracts |  | contracts |  |
| `src/components/CredentialsManager.tsx` |  |  |  | invite-user |
| `src/components/dashboard/GoalsPanel.tsx` | sales_goals | sales_goal_actuals |  |  |
| `src/components/dashboard/JourneyMiniWidget.tsx` | client_journey_stages |  |  |  |
| `src/components/demands/DailyAgenda.tsx` | client_interactions, clients |  |  |  |
| `src/components/demands/DemandComments.tsx` | client_products, demand_comments, notifications, profiles, user_roles |  |  |  |
| `src/components/demands/DemandNotes.tsx` | notes, profiles |  |  |  |
| `src/components/demands/DemandRequestsPanel.tsx` | demand_request_messages, demand_requests |  |  |  |
| `src/components/demands/DemandShareDialog.tsx` | demand_shares |  |  |  |
| `src/components/demands/EditDemandDialog.tsx` | client_products |  |  |  |
| `src/components/demands/ProductDocumentFolders.tsx` | product_document_files, product_document_folders, profiles |  |  |  |
| `src/components/documents/BulkShareDocumentsDialog.tsx` | document_shares |  |  |  |
| `src/components/documents/ClientDocumentFolders.tsx` | client_document_folder_providers, client_document_folders, client_products, documents, service_providers |  | documents |  |
| `src/components/documents/DocumentDialog.tsx` | client_products, clients, document_versions, documents, notifications, partners, sales, service_providers |  |  |  |
| `src/components/finance/ConsistencyReport.tsx` |  | financial_consistency_report |  |  |
| `src/components/finance/ExpensesTab.tsx` | expenses |  | expense-receipts |  |
| `src/components/finance/ProfitReservesPanel.tsx` | profit_reserves |  |  |  |
| `src/components/GlobalSearch.tsx` | client_products, clients, contracts, documents, partners, payments, service_providers |  |  |  |
| `src/components/goals/ActivityGoalsPanel.tsx` | activity_goals, client_interactions |  |  |  |
| `src/components/goals/ActivityMatrixPanel.tsx` | activity_goals, client_interactions, clients, partners, profiles |  |  |  |
| `src/components/leads/ConvertLeadDialog.tsx` | client_products, clients, commissions, contracts, leads, products, tasks |  |  |  |
| `src/components/leads/LeadFollowUpDialog.tsx` | leads, tasks |  |  |  |
| `src/components/leads/LeadFormDialog.tsx` | leads |  |  |  |
| `src/components/leads/LeadsCsvImport.tsx` | leads |  |  |  |
| `src/components/leads/LeadsPipeline.tsx` | leads |  |  |  |
| `src/components/NotificationBell.tsx` | notifications |  |  |  |
| `src/components/nps/NpsCard.tsx` | nps_responses |  |  |  |
| `src/components/partner/PartnerDocumentsSection.tsx` | partner_documents |  |  |  |
| `src/components/PartnerDetailDrawer.tsx` | clients, commissions, partner_products, partners, products |  |  |  |
| `src/components/partner-support/SupportThread.tsx` | partner_support_ticket_messages, partner_support_tickets |  |  |  |
| `src/components/payments/PaymentFormDialog.tsx` | client_products, payments |  |  |  |
| `src/components/products/DeleteProductDialog.tsx` |  | admin_delete_product_cascade |  |  |
| `src/components/products/ProductChecklistDialog.tsx` | product_steps |  |  |  |
| `src/components/products/ProductFormDialog.tsx` | products |  |  |  |
| `src/components/provider/ProductInteractionPanel.tsx` | client_product_status_reports, client_products, demand_comments, demand_deliveries, notifications, user_roles |  | documents |  |
| `src/components/provider/ProviderAssignDialog.tsx` | client_product_providers, client_products, products, service_providers |  |  |  |
| `src/components/provider/ProviderAtuacao.tsx` | provider_interactions, provider_schedule |  |  |  |
| `src/components/provider/ProviderClientDossier.tsx` |  | provider_client_dossier |  |  |
| `src/components/provider/ProviderClients.tsx` | document_shares, documents | provider_client_profiles | documents |  |
| `src/components/provider/ProviderFormDialog.tsx` | service_providers |  |  | invite-user |
| `src/components/provider/ReportStatusDialog.tsx` | client_product_status_reports, client_products, service_providers |  |  |  |
| `src/components/provider/RequestDocumentDialog.tsx` | client_document_requests |  |  |  |
| `src/components/ReferralDialog.tsx` | clients |  |  |  |
| `src/components/RoleHome.tsx` | clients, profiles |  |  |  |
| `src/components/sales/LegacyReviewBanner.tsx` | v_commission_overpayments |  |  |  |
| `src/components/sales/ReceivePaymentDialog.tsx` | commissions, payments |  |  |  |
| `src/components/sales/SaleFormDialog.tsx` | clients, deduction_types, financial_visibility, product_deduction_templates, sale_deductions, sale_visibility_overrides, sales | regenerate_sale_payments |  |  |
| `src/components/sales/SaleParcelsPanel.tsx` | payments |  |  |  |
| `src/components/settings/DeductionsSettings.tsx` | deduction_types, product_deduction_templates |  |  |  |
| `src/components/signatures/SignatureStagesPanel.tsx` | signature_stages |  |  |  |
| `src/components/support/AdminSupportQueue.tsx` | profiles, support_tickets |  |  |  |
| `src/components/support/TicketConversation.tsx` | support_ticket_messages |  |  |  |
| `src/components/support/UserSupportCenter.tsx` | support_ticket_messages, support_tickets |  |  |  |
| `src/components/tasks/QuickTaskDialog.tsx` | tasks |  |  |  |
| `src/components/tasks/TaskDetailsExtras.tsx` | task_checklist_items, task_comments |  |  |  |
| `src/components/visibility/FinancialVisibilityControl.tsx` | financial_visibility |  |  |  |
| `src/components/visibility/SaleDisclosureDialog.tsx` |  | my_sale_disclosure |  |  |
| `src/hooks/useAuth.tsx` | user_roles |  |  |  |
| `src/hooks/useDashboardStats.ts` | activity_logs, clients, commissions, contracts, document_requests, leads, payments, sales, tasks |  |  |  |
| `src/hooks/useExpenseCategories.ts` | system_settings |  |  |  |
| `src/hooks/useOnboardingGuard.ts` | clients, profiles |  |  |  |
| `src/hooks/useReferenceData.ts` | clients, partners, products, profiles, referrers, service_providers, user_roles |  |  |  |
| `src/hooks/useSharedStageFilter.ts` | client_journey_stages, clients |  |  |  |
| `src/hooks/useSystemSettings.ts` | system_settings |  |  |  |
| `src/lib/audit.ts` | audit_logs |  |  |  |
| `src/lib/cashFlow.ts` | cash_settlements | cash_can_access, cash_confirm_historic, cash_create_entry, cash_month, cash_receive_for_sale, cash_refund_payment, cash_reverse, cash_reverse_source, cash_set_opening_balance, cash_settle |  |  |
| `src/lib/clientProductFinancials.ts` | client_product_financials |  |  |  |
| `src/lib/demand.ts` | activity_logs, client_product_status_reports, client_product_steps, client_products, commissions, contracts, demand_comments, documents, payments, tasks | log_demand_activity |  |  |
| `src/lib/salesSchema.ts` | sales |  |  |  |
| `src/lib/timeline.ts` | client_timeline, notifications, user_roles |  |  |  |
| `src/pages/AdminProfile.tsx` | activity_logs, user_roles |  |  |  |
| `src/pages/Agenda.tsx` | clients, tasks |  |  |  |
| `src/pages/Atuacoes.tsx` | client_products, clients, daily_actions |  |  |  |
| `src/pages/AuditLog.tsx` | audit_logs, profiles |  |  |  |
| `src/pages/Automations.tsx` | automation_logs, automation_rules |  |  |  |
| `src/pages/ClientDetail.tsx` | client_interactions, client_products, clients, companies, documents, payments |  |  |  |
| `src/pages/ClientJourney.tsx` | client_journey_stages, client_stage_history, clients, payments, sales |  |  |  |
| `src/pages/ClientOnboarding.tsx` | client_products, clients, contracts, onboarding_documents, payments, profiles |  |  |  |
| `src/pages/ClientPanel.tsx` | client_document_requests, client_products, client_support_tickets, clients, contracts, documents, payments |  |  |  |
| `src/pages/Clients.tsx` | client_products, clients, payments, sales | admin_delete_client_cascade |  |  |
| `src/pages/ClientSupportAdmin.tsx` | client_support_ticket_messages, client_support_tickets |  |  |  |
| `src/pages/CollaboratorPanel.tsx` | client_products, commission_splits, documents, tasks |  |  |  |
| `src/pages/Collaborators.tsx` | commission_splits, profiles, user_roles |  |  | invite-user |
| `src/pages/Commissions.tsx` | clients, commission_rules, commission_splits, commissions, partners, products, profiles, referrers, sales, service_providers |  |  |  |
| `src/pages/Contracts.tsx` | contract_history, contracts |  | contracts |  |
| `src/pages/DashboardAdmin.tsx` | activity_logs, client_interactions, client_products, clients, commission_splits, commissions, contracts, documents, leads, payments, sales, system_settings, tasks | admin_dashboard_snapshot |  |  |
| `src/pages/DemandDetail.tsx` | activity_logs, client_product_status_reports, client_product_steps, client_products, demand_deliveries, documents, profiles, service_providers, tasks |  | documents |  |
| `src/pages/Demands.tsx` | client_product_status_reports, client_products |  |  |  |
| `src/pages/Documents.tsx` | activity_logs, demand_deliveries, document_requests, document_versions, documents, profiles |  | documents |  |
| `src/pages/Finance.tsx` | commissions, expenses, sales |  |  |  |
| `src/pages/FinanceCenter.tsx` | client_products, commission_splits, expenses, financial_alerts, partners, payments, profiles, profit_reserves, referrers, resource_pool_movements, resource_pools, sales, service_providers, system_settings |  | documents | process-alerts |
| `src/pages/Indicators.tsx` | clients, commission_splits, referrers |  |  |  |
| `src/pages/Leads.tsx` | lead_history, leads, proposals |  |  |  |
| `src/pages/MessageTemplates.tsx` | message_templates |  |  |  |
| `src/pages/NotificationsCenter.tsx` | notification_preferences, notifications |  |  |  |
| `src/pages/OperationalCockpit.tsx` | client_product_status_reports, client_products, clients, commissions, contracts, document_requests, documents, notifications, payments, tasks |  |  |  |
| `src/pages/OperationalExpenses.tsx` | expenses |  |  |  |
| `src/pages/PartnerContractsAdmin.tsx` | partner_contracts |  | partner-contracts |  |
| `src/pages/PartnerDetail.tsx` | clients, commission_splits, contracts, partner_contracts, partner_support_tickets, partners |  | partner-contracts |  |
| `src/pages/PartnerMaterialsAdmin.tsx` | partner_materials |  | partner-materials |  |
| `src/pages/PartnerPanel.tsx` | client_document_requests, client_partners, client_products, clients, document_requests, document_versions, documents, partner_contracts, partner_materials, partner_support_tickets, partners | my_commission_statement |  |  |
| `src/pages/Partners.tsx` | commission_splits, partners |  |  | invite-user |
| `src/pages/PartnerSupportAdmin.tsx` | partner_support_tickets, profiles |  |  |  |
| `src/pages/ProductDetail.tsx` | client_products, collaborator_products, contract_templates, products, profiles, sales, service_provider_products, service_providers, user_roles |  |  |  |
| `src/pages/Products.tsx` | partner_products, products, sales |  |  |  |
| `src/pages/Projects.tsx` | clients, partners, products, projects |  |  |  |
| `src/pages/Proposals.tsx` | client_products, leads, proposal_items, proposals, sales |  |  |  |
| `src/pages/ProviderDetail.tsx` | client_product_status_reports, client_products, commission_splits, contracts, documents, service_providers |  |  |  |
| `src/pages/ProviderPanel.tsx` | client_document_folders, client_product_providers, client_product_status_reports, client_products, client_providers, demand_deliveries, demand_requests, document_requests, documents, notifications, service_providers | my_commission_statement |  |  |
| `src/pages/ProviderPerformance.tsx` | client_product_status_reports, client_products, documents, service_providers |  |  |  |
| `src/pages/ProviderReports.tsx` | client_product_status_reports |  |  |  |
| `src/pages/Providers.tsx` | client_products, contracts, service_providers |  |  |  |
| `src/pages/ReferrerPanel.tsx` | clients, referrers | my_commission_statement |  |  |
| `src/pages/Reports.tsx` | client_products, clients, commissions, documents, payments, sales |  |  |  |
| `src/pages/RequestsInbox.tsx` | client_products, demand_requests |  |  |  |
| `src/pages/ResourcePools.tsx` | resource_pool_movements, resource_pools |  |  |  |
| `src/pages/Sales.tsx` | commission_splits, commissions, payments, sales |  |  |  |
| `src/pages/SalesGoals.tsx` | clients, sales_goals | sales_goal_actuals |  |  |
| `src/pages/Settings.tsx` | profiles, system_settings |  |  |  |
| `src/pages/SLAPages.tsx` | client_products |  |  |  |
| `src/pages/Tasks.tsx` | client_products, contracts, payments, tasks |  |  |  |
| `src/pages/UsersPage.tsx` |  |  |  | invite-user |
| `supabase/functions/invite-user/index.ts` | clients, partners, profiles, referrers, service_providers, user_roles |  |  |  |
| `supabase/functions/process-alerts/index.ts` | client_document_requests, commissions, notifications, user_roles |  |  |  |

A lista considera nomes escritos de forma literal. Estes arquivos também escolhem a tabela em tempo de execução: `src/components/clients/ClientLinksManager.tsx`, `src/lib/full-backup.ts`, `src/lib/safe-delete.ts`, `src/pages/Documents.tsx`, `src/pages/FinanceCenter.tsx` e `src/pages/OperationalCockpit.tsx`.
