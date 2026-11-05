# Tabelas e colunas

Estado final depois de todas as migrations. As 113 tabelas e as 1454 colunas foram extraídas das migrations e comparadas com `src/integrations/supabase/types.ts`.

## public.activities

- Criada em: `20260428144839`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `action` | TEXT | 20260428144839 |
| `created_at` | TIMESTAMPTZ | 20260428144839 |
| `description` | TEXT | 20260428144839 |
| `entity_id` | UUID | 20260428144839 |
| `entity_type` | TEXT | 20260428144839 |
| `id` | UUID | 20260428144839 |
| `metadata` | JSONB | 20260428144839 |
| `user_id` | UUID | 20260428144839 |

## public.activity_goals

- Criada em: `20260707002902`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: components/goals/ActivityGoalsPanel.tsx, components/goals/ActivityMatrixPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20260707002902 |
| `id` | uuid | 20260707002902 |
| `kind` | text | 20260707002902 |
| `period_kind` | text | 20260707002902 |
| `period_start` | date | 20260707002902 |
| `target_value` | integer | 20260707002902 |
| `updated_at` | timestamptz | 20260707002902 |

## public.activity_logs

- Criada em: `20260507002128`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 0.
- Usada em: components/clients/tabs/ClientHistory.tsx, hooks/useDashboardStats.ts, lib/demand.ts, pages/AdminProfile.tsx, pages/DashboardAdmin.tsx, pages/DemandDetail.tsx +1

| Coluna | Tipo | Última alteração |
|---|---|---|
| `action` | TEXT | 20260507002128 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260507002128 |
| `entity_id` | UUID | 20260507002128 |
| `entity_type` | TEXT | 20260507002128 |
| `id` | UUID | 20260507002128 |
| `ip_address` | TEXT | 20260509215120 |
| `new_data` | JSONB | 20260507002128 |
| `old_data` | JSONB | 20260507002128 |
| `user_id` | UUID | 20260507002128 |

## public.audit_logs

- Criada em: `20260506204749`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: lib/audit.ts, pages/AuditLog.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `action` | TEXT | 20260506204749 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506204749 |
| `entity_id` | UUID | 20260506204749 |
| `entity_type` | TEXT | 20260506204749 |
| `id` | UUID | 20260506204749 |
| `ip_address` | TEXT | 20260506204749 |
| `metadata` | JSONB | 20260508030153 |
| `new_data` | JSONB | 20260506204749 |
| `old_data` | JSONB | 20260506204749 |
| `user_id` | UUID | 20260506204749 |

## public.automation_logs

- Criada em: `20260509215951`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: pages/Automations.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | TIMESTAMPTZ | 20260509215951 |
| `error_message` | TEXT | 20260509215951 |
| `id` | UUID | 20260509215951 |
| `payload` | JSONB | 20260509215951 |
| `rule_id` | UUID | 20260509215951 |
| `status` | TEXT | 20260509215951 |
| `trigger_key` | TEXT | 20260509215951 |

## public.automation_rules

- Criada em: `20260509215951`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: pages/Automations.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `config` | JSONB | 20260509215951 |
| `created_at` | TIMESTAMPTZ | 20260509215951 |
| `description` | TEXT | 20260509215951 |
| `id` | UUID | 20260509215951 |
| `is_active` | BOOLEAN | 20260509215951 |
| `name` | TEXT | 20260509215951 |
| `trigger_key` | TEXT | 20260509215951 |
| `updated_at` | TIMESTAMPTZ | 20260509215951 |

## public.cash_accounts

- Criada em: `20261104120000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | boolean | 20261104120000 |
| `created_at` | timestamptz | 20261104120000 |
| `id` | uuid | 20261104120000 |
| `is_default` | boolean | 20261104120000 |
| `name` | text | 20261104120000 |

## public.cash_opening_balances

- Criada em: `20261104120000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `account_id` | uuid | 20261104120000 |
| `amount` | numeric(14,2) | 20261104120000 |
| `created_at` | timestamptz | 20261104120000 |
| `created_by` | uuid | 20261104120000 |
| `id` | uuid | 20261104120000 |
| `reason` | text | 20261104120000 |
| `reference_date` | date | 20261104120000 |

## public.cash_other_income

- Criada em: `20261104120000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | numeric(14,2) | 20261104120000 |
| `canceled_at` | timestamptz | 20261104120000 |
| `canceled_reason` | text | 20261104120000 |
| `client_id` | uuid | 20261104120000 |
| `counterparty` | text | 20261104120000 |
| `created_at` | timestamptz | 20261104120000 |
| `created_by` | uuid | 20261104120000 |
| `description` | text | 20261104120000 |
| `due_date` | date | 20261104120000 |
| `id` | uuid | 20261104120000 |
| `nature` | text | 20261104120000 |
| `notes` | text | 20261104120000 |
| `receipt_url` | text | 20261104120000 |

## public.cash_permissions

- Criada em: `20261104120000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20261104120000 |
| `granted_by` | uuid | 20261104120000 |
| `user_id` | uuid | 20261104120000 |

## public.cash_sale_adjustments

- Criada em: `20261104120000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20261104120000 |
| `created_by` | uuid | 20261104120000 |
| `id` | uuid | 20261104120000 |
| `months` | integer | 20261104120000 |
| `new_amount` | numeric(14,2) | 20261104120000 |
| `old_amount` | numeric(14,2) | 20261104120000 |
| `old_provider_cost` | numeric(14,2) | 20261104120000 |
| `old_zenon_cost` | numeric(14,2) | 20261104120000 |
| `reason` | text | 20261104120000 |
| `sale_id` | uuid | 20261104120000 |

## public.cash_settlements

- Criada em: `20261104120000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: lib/cashFlow.ts

| Coluna | Tipo | Última alteração |
|---|---|---|
| `account_id` | uuid | 20261104120000 |
| `amount` | numeric(14,2) | 20261104120000 |
| `created_at` | timestamptz | 20261104120000 |
| `created_by` | uuid | 20261104120000 |
| `direction` | text | 20261104120000 |
| `effective_date` | date | 20261104120000 |
| `id` | uuid | 20261104120000 |
| `idempotency_key` | text | 20261104120000 |
| `kind` | text | 20261104120000 |
| `notes` | text | 20261104120000 |
| `origin` | text | 20261104120000 |
| `payment_method` | text | 20261104120000 |
| `reason` | text | 20261104120000 |
| `reverses_id` | uuid | 20261104120000 |
| `source_id` | uuid | 20261104120000 |
| `source_type` | text | 20261104120000 |
| `verified` | boolean | 20261104120000 |

## public.chat_messages

- Criada em: `20260508183232`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 0.
- Usada em: components/chat/InternalChat.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `content` | TEXT | 20260508183232 |
| `created_at` | TIMESTAMPTZ | 20260508183232 |
| `id` | UUID | 20260508183232 |
| `read` | BOOLEAN | 20260508183232 |
| `recipient_id` | UUID | 20260508183232 |
| `sender_id` | UUID | 20260508183232 |

## public.client_collaborators

- Criada em: `20260605170316`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 2.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `added_by` | uuid | 20260605170316 |
| `client_id` | uuid | 20260605170316 |
| `collaborator_id` | uuid | 20260605170316 |
| `created_at` | timestamptz | 20260605170316 |
| `id` | uuid | 20260605170316 |
| `is_primary` | boolean | 20260605170316 |
| `notes` | text | 20260605170316 |
| `role` | text | 20260605170316 |
| `updated_at` | timestamptz | 20260605170316 |

## public.client_document_folder_providers

- Criada em: `20260701124414`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: components/documents/ClientDocumentFolders.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `folder_id` | uuid | 20260701124414 |
| `granted_at` | timestamptz | 20260701124414 |
| `granted_by` | uuid | 20260701124414 |
| `provider_id` | uuid | 20260701124414 |

## public.client_document_folders

- Criada em: `20260701124414`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 1.
- Usada em: components/documents/ClientDocumentFolders.tsx, pages/ProviderPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | uuid | 20260701124414 |
| `created_at` | timestamptz | 20260701124414 |
| `created_by` | uuid | 20260701124414 |
| `description` | text | 20260701124414 |
| `id` | uuid | 20260701124414 |
| `name` | text | 20260701124414 |
| `updated_at` | timestamptz | 20260701124414 |

## public.client_document_requests

- Criada em: `20260508204650`
- RLS: sim. Tempo real: não. Políticas: 7. Gatilhos: 1.
- Usada em: components/client/ClientDocumentsTab.tsx, components/provider/RequestDocumentDialog.tsx, pages/ClientPanel.tsx, pages/PartnerPanel.tsx, supabase/functions/process-alerts/index.ts

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | UUID | 20260508204650 |
| `client_product_id` | uuid | 20260509221214 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260508204650 |
| `description` | TEXT | 20260508204650 |
| `due_date` | DATE | 20260508204650 |
| `file_url` | TEXT | 20260508204650 |
| `id` | UUID | 20260508204650 |
| `priority` | TEXT | 20260526172303 |
| `reviewed_at` | TIMESTAMP WITH TIME ZONE | 20260508204650 |
| `status` | TEXT | 20260508204650 |
| `title` | TEXT | 20260508204650 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260508204650 |

## public.client_interactions

- Criada em: `20260518212444`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: components/demands/DailyAgenda.tsx, components/goals/ActivityGoalsPanel.tsx, components/goals/ActivityMatrixPanel.tsx, pages/ClientDetail.tsx, pages/DashboardAdmin.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `channel` | TEXT | 20260518212444 |
| `client_id` | UUID | 20260518212444 |
| `created_at` | TIMESTAMPTZ | 20260518212444 |
| `created_by` | UUID | 20260518212444 |
| `done_at` | TIMESTAMPTZ | 20260518212444 |
| `id` | UUID | 20260518212444 |
| `kind` | text | 20260707002902 |
| `next_action_at` | DATE | 20260518212444 |
| `next_action_note` | TEXT | 20260518212444 |
| `occurred_at` | TIMESTAMPTZ | 20260518212444 |
| `status` | TEXT | 20260518212444 |
| `summary` | TEXT | 20260518212444 |
| `updated_at` | TIMESTAMPTZ | 20260518212444 |

## public.client_journey_stages

- Criada em: `20260626052438`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: components/clients/ClientJourneyBadge.tsx, components/clients/InlineStageSelect.tsx, components/dashboard/JourneyMiniWidget.tsx, hooks/useSharedStageFilter.ts, pages/ClientJourney.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | boolean | 20260626052438 |
| `color` | text | 20260626052438 |
| `created_at` | timestamptz | 20260626052438 |
| `description` | text | 20260626052438 |
| `id` | uuid | 20260626052438 |
| `is_captation` | boolean | 20260701150904 |
| `is_terminal` | boolean | 20260626052438 |
| `name` | text | 20260626052438 |
| `position` | integer | 20260626052438 |
| `updated_at` | timestamptz | 20260626052438 |

## public.client_partners

- Criada em: `20260605170316`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 2.
- Usada em: pages/PartnerPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `added_by` | uuid | 20260605170316 |
| `client_id` | uuid | 20260605170316 |
| `created_at` | timestamptz | 20260605170316 |
| `id` | uuid | 20260605170316 |
| `is_primary` | boolean | 20260605170316 |
| `notes` | text | 20260605170316 |
| `partner_id` | uuid | 20260605170316 |
| `role` | text | 20260605170316 |
| `updated_at` | timestamptz | 20260605170316 |

## public.client_product_delays

- Criada em: `20260509235323`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: components/clients/RecordDelayDialog.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_product_id` | UUID | 20260509235323 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260509235323 |
| `delay_reason_category` | TEXT | 20260509235323 |
| `description` | TEXT | 20260509235323 |
| `id` | UUID | 20260509235323 |
| `recorded_at` | TIMESTAMP WITH TIME ZONE | 20260509235323 |
| `recorded_by` | UUID | 20260509235323 |

## public.client_product_financials

- Criada em: `20261103210000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: lib/clientProductFinancials.ts

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_product_id` | uuid | 20261103210000 |
| `custom_value` | numeric | 20261103210000 |
| `discount` | numeric | 20261103210000 |
| `employee_commission` | numeric | 20261103210000 |
| `partner_commission` | numeric | 20261103210000 |
| `updated_at` | timestamptz | 20261103210000 |
| `value` | numeric | 20261103210000 |

## public.client_product_pauses

- Criada em: `20260509235323`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: components/clients/PauseDemandDialog.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_product_id` | UUID | 20260509235323 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260509235323 |
| `freeze_sla` | BOOLEAN | 20260509235323 |
| `id` | UUID | 20260509235323 |
| `notes` | TEXT | 20260509235323 |
| `paused_at` | TIMESTAMP WITH TIME ZONE | 20260509235323 |
| `paused_by` | UUID | 20260509235323 |
| `reason` | TEXT | 20260509235323 |
| `resumed_at` | TIMESTAMP WITH TIME ZONE | 20260509235323 |

## public.client_product_providers

- Criada em: `20260605165827`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 2.
- Usada em: components/clients/DelegateProviderDialog.tsx, components/provider/ProviderAssignDialog.tsx, pages/ProviderPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `added_by` | uuid | 20260605165827 |
| `client_product_id` | uuid | 20260605165827 |
| `created_at` | timestamptz | 20260605165827 |
| `id` | uuid | 20260605165827 |
| `is_primary` | boolean | 20260605165827 |
| `notes` | text | 20260605165827 |
| `role` | text | 20260605165827 |
| `service_provider_id` | uuid | 20260605165827 |
| `updated_at` | timestamptz | 20260605165827 |

## public.client_product_quality_checks

- Criada em: `20260509235522`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: components/clients/QualityApprovalDialog.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `adjustment_deadline` | TIMESTAMP WITH TIME ZONE | 20260509235522 |
| `client_product_id` | UUID | 20260509235522 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260509235522 |
| `feedback` | TEXT | 20260509235522 |
| `id` | UUID | 20260509235522 |
| `internal_notes` | TEXT | 20260509235522 |
| `reviewer_id` | UUID | 20260509235522 |
| `status` | TEXT | 20260509235522 |

## public.client_product_status_reports

- Criada em: `20260508192322`
- RLS: sim. Tempo real: não. Políticas: 9. Gatilhos: 3.
- Usada em: components/clients/tabs/ClientProducts.tsx, components/provider/ProductInteractionPanel.tsx, components/provider/ReportStatusDialog.tsx, lib/demand.ts, pages/DemandDetail.tsx, pages/Demands.tsx +5

| Coluna | Tipo | Última alteração |
|---|---|---|
| `attachments` | JSONB | 20260509024358 |
| `client_product_id` | UUID | 20260508192322 |
| `created_at` | TIMESTAMPTZ | 20260508192322 |
| `id` | UUID | 20260508192322 |
| `next_steps` | TEXT | 20260509024358 |
| `notes` | TEXT | 20260508192322 |
| `pending` | TEXT | 20260509024358 |
| `reported_by` | UUID | 20260508192322 |
| `service_provider_id` | UUID | 20260508205616 |
| `status` | TEXT | 20260508192322 |

## public.client_product_steps

- Criada em: `20260508204650`
- RLS: sim. Tempo real: não. Políticas: 6. Gatilhos: 1.
- Usada em: components/clients/OperationalChecklist.tsx, components/clients/tabs/ClientProductSteps.tsx, lib/demand.ts, pages/DemandDetail.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_product_id` | UUID | 20260508204650 |
| `completed` | BOOLEAN | 20260508204650 |
| `completed_at` | TIMESTAMP WITH TIME ZONE | 20260509212425 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260508204650 |
| `default_responsible` | TEXT | 20260510050051 |
| `description` | TEXT | 20260509212425 |
| `due_date` | TIMESTAMP WITH TIME ZONE | 20260509212425 |
| `id` | UUID | 20260508204650 |
| `is_visible_to_client` | BOOLEAN | 20260510050051 |
| `label` | TEXT | 20260508204650 |
| `notes` | TEXT | 20260509212425 |
| `position` | INTEGER | 20260508204650 |
| `responsible_id` | UUID | 20260509212425 |
| `status` | step_status | 20260509212425 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260508204650 |

## public.client_products

- Criada em: `20260506205328`
- RLS: sim. Tempo real: não. Políticas: 10. Gatilhos: 13.
- Usada em: components/clients/AddProductDialog.tsx, components/clients/ClientFormDialog.tsx, components/clients/ClientTimelineTab.tsx, components/clients/DelegateProviderDialog.tsx, components/clients/IntelligentSummary.tsx, components/clients/OperationalChecklist.tsx +38

| Coluna | Tipo | Última alteração |
|---|---|---|
| `adjustment_description` | TEXT | 20260509235522 |
| `adjustment_due_date` | TIMESTAMP WITH TIME ZONE | 20260509235522 |
| `adjustment_notes` | TEXT | 20260509235522 |
| `client_id` | UUID | 20260506205328 |
| `company_id` | UUID | 20260511180553 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506205328 |
| `current_step_id` | UUID | 20260507002128 |
| `current_steps` | JSONB | 20260506214504 |
| `custom_fields` | JSONB | 20260510000154 |
| `custom_product_name` | TEXT | 20260506205328 |
| `custom_value` | NUMERIC | 20260506214504 |
| `deadline` | TIMESTAMP WITH TIME ZONE | 20260509212222 |
| `delay_reason` | TEXT | 20260509235037 |
| `discount` | NUMERIC | 20260506214504 |
| `employee_commission` | NUMERIC | 20260506214504 |
| `end_date` | DATE | 20260506205328 |
| `id` | UUID | 20260506205328 |
| `internal_notes` | TEXT | 20260509212222 |
| `is_sla_frozen` | BOOLEAN | 20260509235323 |
| `notes` | TEXT | 20260506214504 |
| `partner_commission` | NUMERIC | 20260506214504 |
| `priority` | demand_priority | 20260509212222 |
| `product_id` | UUID | 20260506205328 |
| `required_documents` | JSONB | 20260506214504 |
| `responsible_employee_id` | UUID | 20260506214504 |
| `responsible_provider_id` | UUID | 20260506214504 |
| `sale_id` | uuid | 20260520021818 |
| `service_provider_id` | UUID | 20260507002128 |
| `sla_due_date` | TIMESTAMP WITH TIME ZONE | 20260509235037 |
| `sla_start_date` | TIMESTAMP WITH TIME ZONE | 20260509235037 |
| `sla_status` | TEXT | 20260509235037 |
| `start_date` | DATE | 20260506205328 |
| `status` | TEXT | 20260506205328 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506214504 |
| `value` | DECIMAL(12,2) | 20260506205328 |

## public.client_providers

- Criada em: `20260605170316`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 2.
- Usada em: pages/ProviderPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `added_by` | uuid | 20260605170316 |
| `client_id` | uuid | 20260605170316 |
| `created_at` | timestamptz | 20260605170316 |
| `id` | uuid | 20260605170316 |
| `is_primary` | boolean | 20260605170316 |
| `notes` | text | 20260605170316 |
| `role` | text | 20260605170316 |
| `service_provider_id` | uuid | 20260605170316 |
| `updated_at` | timestamptz | 20260605170316 |

## public.client_referrers

- Criada em: `20260605170316`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 2.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `added_by` | uuid | 20260605170316 |
| `client_id` | uuid | 20260605170316 |
| `created_at` | timestamptz | 20260605170316 |
| `id` | uuid | 20260605170316 |
| `is_primary` | boolean | 20260605170316 |
| `notes` | text | 20260605170316 |
| `referrer_id` | uuid | 20260605170316 |
| `share_percent` | numeric(5,2) | 20260605170316 |
| `updated_at` | timestamptz | 20260605170316 |

## public.client_stage_history

- Criada em: `20260702152910`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: components/clients/ClientJourneyBadge.tsx, pages/ClientJourney.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `changed_at` | timestamptz | 20260702152910 |
| `changed_by` | uuid | 20260702152910 |
| `client_id` | uuid | 20260702152910 |
| `from_stage_id` | uuid | 20260702152910 |
| `from_stage_name` | text | 20260702152910 |
| `id` | uuid | 20260702152910 |
| `to_stage_id` | uuid | 20260702152910 |
| `to_stage_name` | text | 20260702152910 |

## public.client_subscriptions

- Criada em: `20260506154634`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | numeric | 20260506154634 |
| `billing_cycle` | public.billing_cycle | 20260506154634 |
| `client_id` | uuid | 20260506154634 |
| `created_at` | timestamptz | 20260506154634 |
| `created_by` | uuid | 20260506154634 |
| `custom_name` | text | 20260506154634 |
| `end_date` | date | 20260506154634 |
| `id` | uuid | 20260506154634 |
| `next_billing_date` | date | 20260506154634 |
| `notes` | text | 20260506154634 |
| `product_id` | uuid | 20260506154634 |
| `start_date` | date | 20260506154634 |
| `status` | public.subscription_status | 20260506154634 |
| `updated_at` | timestamptz | 20260506154634 |

## public.client_support_ticket_messages

- Criada em: `20260701002113`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 2.
- Usada em: components/client/ClientSupportTab.tsx, pages/ClientSupportAdmin.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `attachment_name` | text | 20260701002113 |
| `attachment_type` | text | 20260701002113 |
| `attachment_url` | text | 20260701002113 |
| `body` | text | 20260701002113 |
| `created_at` | timestamptz | 20260701002113 |
| `id` | uuid | 20260701002113 |
| `sender_id` | uuid | 20260701002113 |
| `sender_role` | text | 20260701002113 |
| `ticket_id` | uuid | 20260701002113 |

## public.client_support_tickets

- Criada em: `20260701002113`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 0.
- Usada em: components/client/ClientSupportTab.tsx, components/clients/ClientTimelineTab.tsx, pages/ClientPanel.tsx, pages/ClientSupportAdmin.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `admin_notes` | text | 20260701002113 |
| `assigned_to` | uuid | 20260701002113 |
| `category` | text | 20260701002113 |
| `client_id` | uuid | 20260701002113 |
| `client_product_id` | uuid | 20260701002113 |
| `closed_at` | timestamptz | 20260701002113 |
| `created_at` | timestamptz | 20260701002113 |
| `created_by` | uuid | 20260701002113 |
| `id` | uuid | 20260701002113 |
| `last_message_at` | timestamptz | 20260701002113 |
| `priority` | text | 20260701002113 |
| `status` | text | 20260701002113 |
| `subject` | text | 20260701002113 |
| `updated_at` | timestamptz | 20260701002113 |

## public.client_timeline

- Criada em: `20260428150955`
- RLS: sim. Tempo real: sim. Políticas: 3. Gatilhos: 0.
- Usada em: lib/timeline.ts

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | UUID | 20260428150955 |
| `created_at` | TIMESTAMPTZ | 20260428150955 |
| `description` | TEXT | 20260428150955 |
| `event_type` | TEXT | 20260428150955 |
| `id` | UUID | 20260428150955 |
| `metadata` | JSONB | 20260428150955 |
| `title` | TEXT | 20260428150955 |
| `user_id` | UUID | 20260428150955 |

## public.clients

- Criada em: `20260428144839`
- RLS: sim. Tempo real: sim. Políticas: 16. Gatilhos: 11.
- Usada em: components/AppSidebar.tsx, components/client/PaymentReceiptDialog.tsx, components/clients/AddProductDialog.tsx, components/clients/ClientFormDialog.tsx, components/clients/ClientJourneyBadge.tsx, components/clients/ClientLinksManager.tsx +35

| Coluna | Tipo | Última alteração |
|---|---|---|
| `address` | TEXT | 20260428144839 |
| `address_city` | TEXT | 20260506205328 |
| `address_complement` | TEXT | 20260506205328 |
| `address_country` | TEXT | 20260506205328 |
| `address_neighborhood` | TEXT | 20260506205328 |
| `address_number` | TEXT | 20260506193000 |
| `address_state` | TEXT | 20260506205328 |
| `address_street` | TEXT | 20260506193000 |
| `address_zip_code` | TEXT | 20260506205328 |
| `birth_date` | DATE | 20260506205328 |
| `churn_risk` | TEXT | 20260510042309 |
| `city` | TEXT | 20260428144839 |
| `collaborator_commission_percent` | numeric(5 | 20260518212030 |
| `collaborator_id` | UUID | 20260507002128 |
| `commission_value` | DECIMAL(12 | 20260506200310 |
| `company` | TEXT | 20260428144839 |
| `completion_date` | DATE | 20260506205328 |
| `contract_value` | DECIMAL(12 | 20260506200310 |
| `created_at` | TIMESTAMPTZ | 20260428144839 |
| `created_by` | UUID | 20260428144839 |
| `document` | TEXT | 20260428144839 |
| `document_type` | TEXT | 20260506205328 |
| `email` | TEXT | 20260428144839 |
| `entry_date` | DATE | 20260506205328 |
| `full_name` | TEXT | 20260428144839 |
| `health_score` | INTEGER | 20260510042309 |
| `id` | UUID | 20260428144839 |
| `indicator_id` | UUID | 20260506205328 |
| `internal_notes` | TEXT | 20260506205328 |
| `is_closed` | boolean | 20260626061407 |
| `journey_stage_id` | uuid | 20260626052438 |
| `journey_updated_at` | timestamptz | 20260626052438 |
| `mandatory_steps` | jsonb | 20260521010213 |
| `manual_approval_required` | boolean | 20260521010213 |
| `notes` | TEXT | 20260428144839 |
| `onboarding_completed_at` | TIMESTAMP WITH TIME ZONE | 20260510000154 |
| `onboarding_progress` | INTEGER | 20260510000154 |
| `onboarding_status` | TEXT | 20260510000154 |
| `origin` | TEXT | 20260506200310 |
| `partner_commission_percent` | numeric(5 | 20260518212030 |
| `partner_id` | UUID | 20260507002128 |
| `payment_method` | TEXT | 20260506205328 |
| `payment_status` | TEXT | 20260506205328 |
| `phone` | TEXT | 20260428144839 |
| `priority` | TEXT | 20260506205328 |
| `provider_id` | UUID | 20260506205328 |
| `referral_id` | UUID | 20260506193000 |
| `referrer_commission_percent` | numeric(5 | 20260518212030 |
| `referrer_id` | uuid | 20260506154634 |
| `responsible_id` | UUID | 20260506205328 |
| `sale_date` | DATE | 20260506205328 |
| `sale_value` | DECIMAL(12 | 20260506205328 |
| `service_provider_id` | UUID | 20260506200310 |
| `source` | TEXT | 20260506205328 |
| `stage_changed_at` | timestamptz | 20260701141608 |
| `state` | TEXT | 20260428144839 |
| `status` | public.client_status | 20260428144839 |
| `tags` | TEXT[] | 20260428150955 |
| `updated_at` | TIMESTAMPTZ | 20260428144839 |
| `user_id` | UUID | 20260428144839 |
| `whatsapp` | TEXT | 20260506205328 |

## public.collaborator_products

- Criada em: `20260520153715`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: pages/ProductDetail.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | boolean | 20260520153715 |
| `collaborator_id` | uuid | 20260520153715 |
| `created_at` | timestamp with time zone | 20260520153715 |
| `id` | uuid | 20260520153715 |
| `notes` | text | 20260520153715 |
| `product_id` | uuid | 20260520153715 |
| `updated_at` | timestamp with time zone | 20260520153715 |

## public.commission_audit_log

- Criada em: `20260702212656`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: components/audit/FinancialAuditPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `actor_email` | text | 20260702212656 |
| `actor_id` | uuid | 20260702212656 |
| `amount` | numeric | 20260702212656 |
| `beneficiary_id` | uuid | 20260702212656 |
| `beneficiary_type` | text | 20260702212656 |
| `created_at` | timestamptz | 20260702212656 |
| `event` | text | 20260702212656 |
| `id` | uuid | 20260702212656 |
| `new_status` | text | 20260702212656 |
| `old_status` | text | 20260702212656 |
| `payment_id` | uuid | 20260702212656 |
| `percent` | numeric | 20260702212656 |
| `sale_id` | uuid | 20260702212656 |
| `source` | text | 20260702212656 |
| `source_id` | uuid | 20260702212656 |
| `source_table` | text | 20260702212656 |

## public.commission_rules

- Criada em: `20260509213341`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: pages/Commissions.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260509213341 |
| `id` | UUID | 20260509213341 |
| `is_recurring` | BOOLEAN | 20260509213341 |
| `partner_id` | UUID | 20260509213341 |
| `product_id` | UUID | 20260509213341 |
| `release_after_payment` | BOOLEAN | 20260509213341 |
| `rule_type` | TEXT | 20260509213341 |
| `trigger_event` | TEXT | 20260509213341 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260509213341 |
| `value` | NUMERIC(15,2) | 20260509213341 |

## public.commission_splits

- Criada em: `20260506154634`
- RLS: sim. Tempo real: sim. Políticas: 3. Gatilhos: 7.
- Usada em: components/commissions/AllBeneficiariesTable.tsx, pages/CollaboratorPanel.tsx, pages/Collaborators.tsx, pages/Commissions.tsx, pages/DashboardAdmin.tsx, pages/FinanceCenter.tsx +5

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | numeric | 20260506154634 |
| `beneficiary_id` | uuid | 20260506154634 |
| `beneficiary_type` | public.beneficiary_type | 20260506154634 |
| `client_id` | uuid | 20260704093814 |
| `client_product_id` | uuid | 20260704093814 |
| `created_at` | timestamptz | 20260506154634 |
| `id` | uuid | 20260506154634 |
| `notes` | text | 20260506154634 |
| `paid_at` | timestamptz | 20260506154634 |
| `payment_id` | uuid | 20260704093814 |
| `payment_method` | text | 20260506154634 |
| `percent` | numeric | 20260506154634 |
| `released_amount` | numeric | 20261103240000 |
| `sale_id` | uuid | 20260506154634 |
| `status` | public.split_status | 20260506154634 |
| `updated_at` | timestamptz | 20260506154634 |

## public.commissions

- Criada em: `20260428144839`
- RLS: sim. Tempo real: sim. Políticas: 3. Gatilhos: 8.
- Usada em: components/leads/ConvertLeadDialog.tsx, components/PartnerDetailDrawer.tsx, components/sales/ReceivePaymentDialog.tsx, hooks/useDashboardStats.ts, lib/demand.ts, pages/Commissions.tsx +6

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | NUMERIC(14,2) | 20260428144839 |
| `applied_rule_description` | TEXT | 20260509213341 |
| `applied_rule_id` | UUID | 20260509213341 |
| `approval_date` | TIMESTAMP WITH TIME ZONE | 20260506221746 |
| `approved_by` | UUID | 20260506221746 |
| `client_id` | UUID | 20260507002225 |
| `client_product_id` | uuid | 20260509221214 |
| `collaborator_id` | UUID | 20260526164321 |
| `commission_type` | TEXT | 20260506234155 |
| `created_at` | TIMESTAMPTZ | 20260428144839 |
| `expected_date` | DATE | 20260509213341 |
| `id` | UUID | 20260428144839 |
| `is_recurring` | BOOLEAN | 20260506221746 |
| `notes` | TEXT | 20260428144839 |
| `paid_at` | TIMESTAMPTZ | 20260428144839 |
| `partner_id` | UUID | 20260428144839 |
| `payment_date` | TIMESTAMP WITH TIME ZONE | 20260506221746 |
| `payment_id` | uuid | 20260702210531 |
| `payment_method` | TEXT | 20260428144839 |
| `percent` | NUMERIC(5,2) | 20260428144839 |
| `product_id` | UUID | 20260507002225 |
| `reason` | TEXT | 20260506221746 |
| `receipt_url` | TEXT | 20260509213341 |
| `referrer_id` | UUID | 20260526164321 |
| `released_amount` | numeric | 20261103240000 |
| `rule_type` | TEXT | 20260506221746 |
| `rule_value` | NUMERIC | 20260506234155 |
| `sale_id` | UUID | 20260428144839 |
| `sale_value` | NUMERIC(15 | 20260509213341 |
| `service_provider_id` | uuid | 20260701001044 |
| `status` | public.commission_status | 20260428144839 |
| `updated_at` | TIMESTAMPTZ | 20260428144839 |
| `workflow_status` | public.commission_workflow_status | 20260509213341 |

## public.companies

- Criada em: `20260511180553`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 1.
- Usada em: components/clients/AddProductDialog.tsx, components/clients/CompanyFormDialog.tsx, pages/ClientDetail.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `address_city` | TEXT | 20260511180553 |
| `address_complement` | TEXT | 20260511180553 |
| `address_neighborhood` | TEXT | 20260511180553 |
| `address_number` | TEXT | 20260511180553 |
| `address_state` | TEXT | 20260511180553 |
| `address_street` | TEXT | 20260511180553 |
| `address_zip_code` | TEXT | 20260511180553 |
| `client_id` | UUID | 20260511180553 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260511180553 |
| `document` | TEXT | 20260511180553 |
| `email` | TEXT | 20260511180553 |
| `id` | UUID | 20260511180553 |
| `name` | TEXT | 20260511180553 |
| `phone` | TEXT | 20260511180553 |
| `trade_name` | TEXT | 20260511180553 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260511180553 |

## public.company_contacts

- Criada em: `20260511180553`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: components/clients/CompanyContactsManager.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `company_id` | UUID | 20260511180553 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260511180553 |
| `email` | TEXT | 20260511180553 |
| `id` | UUID | 20260511180553 |
| `is_primary` | BOOLEAN | 20260511180553 |
| `name` | TEXT | 20260511180553 |
| `permissions` | JSONB | 20260511180553 |
| `profile_id` | UUID | 20260511180553 |
| `role` | TEXT | 20260511180553 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260511180553 |

## public.contract_folders

- Criada em: `20260701125045`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: components/contracts/ContractFolders.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | uuid | 20260701125045 |
| `created_at` | timestamptz | 20260701125045 |
| `created_by` | uuid | 20260701125045 |
| `description` | text | 20260701125045 |
| `id` | uuid | 20260701125045 |
| `name` | text | 20260701125045 |
| `updated_at` | timestamptz | 20260701125045 |

## public.contract_history

- Criada em: `20260508185417`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 0.
- Usada em: components/client/ClientContractsTab.tsx, pages/Contracts.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `action_by` | UUID | 20260508185417 |
| `contract_id` | UUID | 20260508185417 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260508185417 |
| `file_path` | TEXT | 20260508185417 |
| `id` | UUID | 20260508185417 |
| `notes` | TEXT | 20260508185417 |
| `status` | TEXT | 20260508185417 |

## public.contract_templates

- Criada em: `20260520153715`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: pages/ProductDetail.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | boolean | 20260520153715 |
| `content` | text | 20260520153715 |
| `created_at` | timestamp with time zone | 20260520153715 |
| `created_by` | uuid | 20260520153715 |
| `description` | text | 20260520153715 |
| `file_path` | text | 20260520153715 |
| `id` | uuid | 20260520153715 |
| `name` | text | 20260520153715 |
| `updated_at` | timestamp with time zone | 20260520153715 |

## public.contracts

- Criada em: `20260506231554`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 5.
- Usada em: components/client/ClientContractsTab.tsx, components/clients/ClientFichaTabs.tsx, components/clients/IntelligentSummary.tsx, components/clients/tabs/ClientContracts.tsx, components/contracts/ContractDialog.tsx, components/contracts/ContractFolders.tsx +13

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | NUMERIC(15, 2) | 20260506231554 |
| `client_id` | UUID | 20260506231554 |
| `client_product_id` | uuid | 20260509221214 |
| `contract_kind` | TEXT | 20260508192322 |
| `contract_type` | TEXT | 20260509214030 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506231554 |
| `expires_at` | TIMESTAMP WITH TIME ZONE | 20260509214030 |
| `file_path` | TEXT | 20260506231554 |
| `finished_at` | TIMESTAMP WITH TIME ZONE | 20260506231554 |
| `folder_id` | uuid | 20260701125045 |
| `id` | UUID | 20260506231554 |
| `internal_notes` | TEXT | 20260506231554 |
| `name` | TEXT | 20260506231554 |
| `partner_id` | UUID | 20260508192322 |
| `product_id` | UUID | 20260506231554 |
| `provider_id` | UUID | 20260509214030 |
| `sale_id` | UUID | 20260506231554 |
| `sent_at` | TIMESTAMP WITH TIME ZONE | 20260506231554 |
| `signed_at` | TIMESTAMP WITH TIME ZONE | 20260506231554 |
| `signed_file_path` | text | 20260701125045 |
| `signed_uploaded_at` | timestamptz | 20260701125045 |
| `status` | public.contract_status | 20260506231554 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506231554 |

## public.daily_actions

- Criada em: `20260514202739`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: components/clients/tabs/ClientHistory.tsx, pages/Atuacoes.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `assigned_to` | UUID | 20260514202739 |
| `client_id` | UUID | 20260514202739 |
| `client_product_id` | UUID | 20260514202739 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260514202739 |
| `created_by` | UUID | 20260514202739 |
| `executed_at` | TIMESTAMP WITH TIME ZONE | 20260514202739 |
| `executed_by` | UUID | 20260514202739 |
| `execution_notes` | TEXT | 20260514202739 |
| `id` | UUID | 20260514202739 |
| `notes` | TEXT | 20260514202739 |
| `priority` | TEXT | 20260514202739 |
| `result` | TEXT | 20260514202739 |
| `scheduled_date` | DATE | 20260514202739 |
| `status` | TEXT | 20260514202739 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260514202739 |

## public.deduction_types

- Criada em: `20261103220000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: components/sales/SaleFormDialog.tsx, components/settings/DeductionsSettings.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | boolean | 20261103220000 |
| `category` | text | 20261103220000 |
| `created_at` | timestamptz | 20261103220000 |
| `default_fixed_amount` | numeric | 20261103220000 |
| `default_percent` | numeric | 20261103220000 |
| `id` | uuid | 20261103220000 |
| `name` | text | 20261103220000 |
| `sort_order` | integer | 20261103220000 |
| `updated_at` | timestamptz | 20261103220000 |

## public.demand_comments

- Criada em: `20260509212745`
- RLS: sim. Tempo real: não. Políticas: 9. Gatilhos: 5.
- Usada em: components/clients/ClientTimelineTab.tsx, components/demands/DemandComments.tsx, components/provider/ProductInteractionPanel.tsx, lib/demand.ts

| Coluna | Tipo | Última alteração |
|---|---|---|
| `attachments` | JSONB | 20260509212745 |
| `author_id` | UUID | 20260509212745 |
| `client_product_id` | UUID | 20260509212745 |
| `content` | TEXT | 20260509212745 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260509212745 |
| `id` | UUID | 20260509212745 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260509212745 |
| `visibility` | comment_visibility | 20260509212745 |

## public.demand_deliveries

- Criada em: `20260511180553`
- RLS: sim. Tempo real: não. Políticas: 7. Gatilhos: 3.
- Usada em: components/clients/ClientTimelineTab.tsx, components/clients/tabs/ClientDeliveries.tsx, components/provider/ProductInteractionPanel.tsx, pages/DemandDetail.tsx, pages/Documents.tsx, pages/ProviderPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_product_id` | UUID | 20260511180553 |
| `collaborator_id` | UUID | 20260526172633 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260511180553 |
| `description` | TEXT | 20260511180553 |
| `file_url` | TEXT | 20260511180553 |
| `files` | jsonb | 20260701140907 |
| `id` | UUID | 20260511180553 |
| `provider_id` | UUID | 20260526172633 |
| `status` | TEXT | 20260511180553 |
| `title` | TEXT | 20260511180553 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260511180553 |

## public.demand_request_messages

- Criada em: `20260701123649`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 1.
- Usada em: components/demands/DemandRequestsPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `author_id` | uuid | 20260701123649 |
| `author_role` | text | 20260701123649 |
| `created_at` | timestamptz | 20260701123649 |
| `id` | uuid | 20260701123649 |
| `message` | text | 20260701123649 |
| `request_id` | uuid | 20260701123649 |

## public.demand_requests

- Criada em: `20260626052438`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 4.
- Usada em: components/clients/ClientTimelineTab.tsx, components/demands/DemandRequestsPanel.tsx, pages/ProviderPanel.tsx, pages/RequestsInbox.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | uuid | 20260626052438 |
| `client_product_id` | uuid | 20260626052438 |
| `created_at` | timestamptz | 20260626052438 |
| `description` | text | 20260626052438 |
| `id` | uuid | 20260626052438 |
| `kind` | text | 20260626052438 |
| `requested_by` | uuid | 20260626052438 |
| `requested_role` | text | 20260626052438 |
| `responded_at` | timestamptz | 20260626052438 |
| `responded_by` | uuid | 20260626052438 |
| `response` | text | 20260626052438 |
| `status` | text | 20260626052438 |
| `target_role` | text | 20260626052438 |
| `title` | text | 20260626052438 |
| `updated_at` | timestamptz | 20260626052438 |

## public.demand_shares

- Criada em: `20260626051143`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 1.
- Usada em: components/demands/DemandShareDialog.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `can_download` | boolean | 20260626051143 |
| `client_product_id` | uuid | 20260626051143 |
| `created_at` | timestamptz | 20260626051143 |
| `id` | uuid | 20260626051143 |
| `invited_by` | uuid | 20260626051143 |
| `message` | text | 20260626051143 |
| `provider_id` | uuid | 20260626051143 |
| `responded_at` | timestamptz | 20260626051143 |
| `status` | text | 20260626051143 |
| `updated_at` | timestamptz | 20260626051143 |
| `viewed_at` | timestamptz | 20260626051143 |

## public.document_history

- Criada em: `20260508184325`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260508184325 |
| `created_by` | UUID | 20260508184325 |
| `file_url` | TEXT | 20260508184325 |
| `id` | UUID | 20260508184325 |
| `rejection_reason` | TEXT | 20260508184325 |
| `request_id` | UUID | 20260508184325 |
| `status` | TEXT | 20260508184325 |

## public.document_requests

- Criada em: `20260506192802`
- RLS: sim. Tempo real: não. Políticas: 8. Gatilhos: 3.
- Usada em: components/client/ClientDocumentsTab.tsx, components/clients/ClientTimelineTab.tsx, hooks/useDashboardStats.ts, pages/Documents.tsx, pages/OperationalCockpit.tsx, pages/PartnerPanel.tsx +1

| Coluna | Tipo | Última alteração |
|---|---|---|
| `approval_date` | TIMESTAMP WITH TIME ZONE | 20260507002543 |
| `client_id` | UUID | 20260506192802 |
| `client_product_id` | UUID | 20260508192322 |
| `collaborator_id` | UUID | 20260526172633 |
| `deadline` | TIMESTAMP WITH TIME ZONE | 20260507002543 |
| `description` | TEXT | 20260506192802 |
| `file_url` | TEXT | 20260506192802 |
| `id` | UUID | 20260506192802 |
| `observations` | TEXT | 20260507002543 |
| `priority` | TEXT | 20260526172303 |
| `product_id` | UUID | 20260507002543 |
| `provider_id` | UUID | 20260526172633 |
| `rejection_reason` | TEXT | 20260507002543 |
| `request_title` | TEXT | 20260506192802 |
| `requested_at` | TIMESTAMP WITH TIME ZONE | 20260506192802 |
| `status` | TEXT | 20260506192802 |
| `submission_date` | TIMESTAMP WITH TIME ZONE | 20260507002543 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506192802 |

## public.document_shares

- Criada em: `drizzle 0000`
- RLS: sim. Tempo real: não. Políticas: 6. Gatilhos: 1.
- Usada em: components/documents/BulkShareDocumentsDialog.tsx, components/provider/ProviderClients.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `can_download` | boolean | drizzle 0000 |
| `created_at` | timestamptz | drizzle 0000 |
| `document_id` | uuid | drizzle 0000 |
| `expires_at` | timestamptz | drizzle 0000 |
| `id` | uuid | drizzle 0000 |
| `message` | text | drizzle 0000 |
| `provider_id` | uuid | drizzle 0000 |
| `shared_by` | uuid | drizzle 0000 |
| `viewed_at` | timestamptz | drizzle 0000 |

## public.document_versions

- Criada em: `20260518094800`
- RLS: sim. Tempo real: não. Políticas: 6. Gatilhos: 0.
- Usada em: components/documents/DocumentDialog.tsx, pages/Documents.tsx, pages/PartnerPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20260518094800 |
| `document_id` | uuid | 20260518094800 |
| `file_path` | text | 20260518094800 |
| `file_size` | integer | 20260518094800 |
| `id` | uuid | 20260518094800 |
| `mime_type` | text | 20260518094800 |
| `note` | text | 20260518094800 |
| `uploaded_by` | uuid | 20260518094800 |
| `version_number` | integer | 20260518094800 |

## public.documents

- Criada em: `20260428144839`
- RLS: sim. Tempo real: não. Políticas: 26. Gatilhos: 7.
- Usada em: components/client/ClientDocumentsTab.tsx, components/client/PaymentReceiptDialog.tsx, components/clients/IntelligentSummary.tsx, components/clients/tabs/ClientDocuments.tsx, components/documents/ClientDocumentFolders.tsx, components/documents/DocumentDialog.tsx +15

| Coluna | Tipo | Última alteração |
|---|---|---|
| `approved_by` | UUID | 20260509212512 |
| `client_id` | UUID | 20260428144839 |
| `client_product_id` | UUID | 20260511180553 |
| `collaborator_id` | UUID | 20260526172633 |
| `completed_file_path` | text | 20260701142405 |
| `completed_file_size` | integer | 20260701142405 |
| `completed_mime_type` | text | 20260701142405 |
| `completed_uploaded_at` | timestamptz | 20260701142405 |
| `completed_uploaded_by` | uuid | 20260701142405 |
| `created_at` | TIMESTAMPTZ | 20260428144839 |
| `description` | TEXT | 20260428144839 |
| `due_date` | DATE | 20260506231326 |
| `file_path` | TEXT | 20260428144839 |
| `file_size` | INTEGER | 20260428144839 |
| `folder_id` | uuid | 20260701124414 |
| `id` | UUID | 20260428144839 |
| `internal_notes` | TEXT | 20260509212512 |
| `is_public` | BOOLEAN | 20260509212512 |
| `is_required` | boolean | 20260509023723 |
| `mime_type` | TEXT | 20260428144839 |
| `name` | TEXT | 20260428144839 |
| `parent_document_id` | uuid | 20260702204700 |
| `partner_id` | uuid | 20260630211354 |
| `phase_label` | text | 20260702204700 |
| `priority` | TEXT | 20260526172303 |
| `product_id` | UUID | 20260506231326 |
| `provider_id` | UUID | 20260526172633 |
| `rejection_reason` | TEXT | 20260509212512 |
| `requested_at` | TIMESTAMP WITH TIME ZONE | 20260509212616 |
| `requested_by` | UUID | 20260509212616 |
| `requires_signature` | boolean | 20260701142405 |
| `reviewed_at` | TIMESTAMP WITH TIME ZONE | 20260506231326 |
| `sale_id` | UUID | 20260428144839 |
| `signed_file_path` | text | 20260701142405 |
| `signed_file_size` | integer | 20260701142405 |
| `signed_mime_type` | text | 20260701142405 |
| `signed_uploaded_at` | timestamptz | 20260701142405 |
| `signed_uploaded_by` | uuid | 20260701142405 |
| `source` | text | 20260626051143 |
| `status` | public.document_status | 20260428144839 |
| `updated_at` | TIMESTAMPTZ | 20260428144839 |
| `uploaded_at` | TIMESTAMP WITH TIME ZONE | 20260506231326 |
| `uploaded_by` | uuid | 20260626051143 |

## public.employees

- Criada em: `20260506230414`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506230414 |
| `email` | TEXT | 20260506230414 |
| `function` | TEXT | 20260506230414 |
| `has_system_access` | BOOLEAN | 20260506230414 |
| `id` | UUID | 20260506230414 |
| `name` | TEXT | 20260506230414 |
| `notes` | TEXT | 20260506230414 |
| `permissions` | JSONB | 20260506230414 |
| `phone` | TEXT | 20260506230414 |
| `role` | TEXT | 20260506230414 |
| `status` | TEXT | 20260506230414 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506230414 |
| `user_id` | UUID | 20260506230414 |

## public.expenses

- Criada em: `20260428150955`
- RLS: sim. Tempo real: sim. Políticas: 2. Gatilhos: 3.
- Usada em: components/finance/ExpensesTab.tsx, pages/Finance.tsx, pages/FinanceCenter.tsx, pages/OperationalExpenses.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | NUMERIC(12,2) | 20260428150955 |
| `auto_provision` | boolean | 20261103240000 |
| `category` | TEXT | 20260428150955 |
| `created_at` | TIMESTAMPTZ | 20260428150955 |
| `created_by` | UUID | 20260428150955 |
| `description` | TEXT | 20260428150955 |
| `due_date` | date | 20260702133635 |
| `expense_date` | DATE | 20260428150955 |
| `id` | UUID | 20260428150955 |
| `notes` | text | 20260702133635 |
| `paid` | boolean | 20260702133635 |
| `paid_at` | date | 20260702133635 |
| `payment_id` | uuid | 20261103240000 |
| `payment_method` | text | 20260702133635 |
| `receipt_url` | text | 20260702133635 |
| `reference_month` | date | 20260702133635 |
| `sale_deduction_id` | uuid | 20261103240000 |
| `sale_id` | uuid | 20261103240000 |
| `subcategory` | text | 20260702133635 |
| `updated_at` | timestamptz | 20260702133635 |
| `vendor` | text | 20260702133635 |

## public.financial_alerts

- Criada em: `20260509213159`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 0.
- Usada em: pages/FinanceCenter.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `alert_type` | TEXT | 20260509213159 |
| `client_id` | UUID | 20260509213159 |
| `commission_id` | UUID | 20260509213159 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260509213159 |
| `id` | UUID | 20260509213159 |
| `is_read` | BOOLEAN | 20260509213159 |
| `message` | TEXT | 20260509213159 |
| `payment_id` | UUID | 20260509213159 |
| `resolved_at` | TIMESTAMP WITH TIME ZONE | 20260509213159 |
| `severity` | TEXT | 20260509213159 |
| `title` | TEXT | 20260509213159 |

## public.financial_visibility

- Criada em: `20261103230000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: components/sales/SaleFormDialog.tsx, components/visibility/FinancialVisibilityControl.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `beneficiary_id` | uuid | 20261103230000 |
| `beneficiary_type` | text | 20261103230000 |
| `see_deductions` | boolean | 20261103230000 |
| `see_gross` | boolean | 20261103230000 |
| `see_payments` | boolean | 20261103230000 |
| `updated_at` | timestamptz | 20261103230000 |
| `updated_by` | uuid | 20261103230000 |

## public.lead_history

- Criada em: `20260506221520`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: pages/Leads.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `action` | TEXT | 20260506221520 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506221520 |
| `created_by` | UUID | 20260506221520 |
| `description` | TEXT | 20260506221520 |
| `id` | UUID | 20260506221520 |
| `lead_id` | UUID | 20260506221520 |
| `metadata` | JSONB | 20260506221520 |

## public.leads

- Criada em: `20260506204749`
- RLS: sim. Tempo real: sim. Políticas: 3. Gatilhos: 5.
- Usada em: components/leads/ConvertLeadDialog.tsx, components/leads/LeadFollowUpDialog.tsx, components/leads/LeadFormDialog.tsx, components/leads/LeadsCsvImport.tsx, components/leads/LeadsPipeline.tsx, hooks/useDashboardStats.ts +3

| Coluna | Tipo | Última alteração |
|---|---|---|
| `close_probability` | integer | 20260510052044 |
| `company` | text | 20260510052044 |
| `conversion_date` | TIMESTAMP WITH TIME ZONE | 20260506221520 |
| `converted_to_client_id` | UUID | 20260506221520 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506204749 |
| `email` | TEXT | 20260506204749 |
| `estimated_value` | numeric | 20260510052044 |
| `full_name` | TEXT | 20260506204749 |
| `id` | UUID | 20260506204749 |
| `next_action` | text | 20260510052044 |
| `next_action_date` | date | 20260510052044 |
| `notes` | TEXT | 20260506204749 |
| `partner_id` | UUID | 20260507002225 |
| `phone` | TEXT | 20260506204749 |
| `product_id` | UUID | 20260506221520 |
| `referral_id` | UUID | 20260506221520 |
| `responsible_id` | UUID | 20260506221520 |
| `source` | TEXT | 20260506204749 |
| `status` | TEXT | 20260506204749 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506204749 |
| `whatsapp` | TEXT | 20260506221520 |

## public.message_templates

- Criada em: `20260508183232`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: pages/MessageTemplates.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | BOOLEAN | 20260508183232 |
| `body` | TEXT | 20260508183232 |
| `channel` | TEXT | 20260508183232 |
| `created_at` | TIMESTAMPTZ | 20260508183232 |
| `created_by` | UUID | 20260508183232 |
| `id` | UUID | 20260508183232 |
| `name` | TEXT | 20260508183232 |
| `subject` | TEXT | 20260508183232 |
| `updated_at` | TIMESTAMPTZ | 20260508183232 |
| `variables` | JSONB | 20260508183232 |

## public.notes

- Criada em: `20260507002128`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 0.
- Usada em: components/clients/ClientFichaTabs.tsx, components/demands/DemandNotes.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | UUID | 20260507002128 |
| `client_product_id` | uuid | 20260509221214 |
| `content` | TEXT | 20260507002128 |
| `contract_id` | UUID | 20260507002128 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260507002128 |
| `created_by` | UUID | 20260507002128 |
| `id` | UUID | 20260507002128 |
| `is_private` | BOOLEAN | 20260507002128 |
| `product_id` | UUID | 20260507002128 |
| `task_id` | UUID | 20260507002128 |

## public.notification_preferences

- Criada em: `20260701140044`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 1.
- Usada em: pages/NotificationsCenter.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20260701140044 |
| `email` | boolean | 20260701140044 |
| `id` | uuid | 20260701140044 |
| `in_app` | boolean | 20260701140044 |
| `type` | text | 20260701140044 |
| `updated_at` | timestamptz | 20260701140044 |
| `user_id` | uuid | 20260701140044 |

## public.notifications

- Criada em: `20260508205032`
- RLS: sim. Tempo real: sim. Políticas: 8. Gatilhos: 0.
- Usada em: components/client/PaymentReceiptDialog.tsx, components/demands/DemandComments.tsx, components/documents/DocumentDialog.tsx, components/NotificationBell.tsx, components/provider/ProductInteractionPanel.tsx, lib/timeline.ts +4

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260508205032 |
| `id` | UUID | 20260508205032 |
| `link` | TEXT | 20260508205032 |
| `message` | TEXT | 20260508205032 |
| `read` | BOOLEAN | 20260508205032 |
| `title` | TEXT | 20260508205032 |
| `type` | TEXT | 20260508205032 |
| `user_id` | UUID | 20260508205032 |

## public.nps_responses

- Criada em: `20260508183232`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 0.
- Usada em: components/nps/NpsCard.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | UUID | 20260508183232 |
| `comment` | TEXT | 20260508183232 |
| `created_at` | TIMESTAMPTZ | 20260508183232 |
| `id` | UUID | 20260508183232 |
| `score` | INT | 20260508183232 |

## public.onboarding_documents

- Criada em: `20260519005624`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 0.
- Usada em: components/clients/ClientFormDialog.tsx, components/clients/tabs/ClientOnboardingTab.tsx, pages/ClientOnboarding.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | UUID | 20260519005624 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260519005624 |
| `description` | TEXT | 20260519005624 |
| `file_name` | TEXT | 20260519005624 |
| `file_url` | TEXT | 20260519005624 |
| `id` | UUID | 20260519005624 |
| `is_required` | BOOLEAN | 20260519005624 |
| `name` | TEXT | 20260519005624 |
| `product_id` | UUID | 20260519005624 |
| `rejection_reason` | TEXT | 20260519005624 |
| `reviewed_at` | TIMESTAMP WITH TIME ZONE | 20260519005624 |
| `reviewed_by` | UUID | 20260519005624 |
| `status` | TEXT | 20260519005624 |
| `submitted_at` | TIMESTAMP WITH TIME ZONE | 20260519005624 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260519005624 |
| `version` | INTEGER | 20260519005624 |

## public.onboarding_history

- Criada em: `20260519005624`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `action` | TEXT | 20260519005624 |
| `client_id` | UUID | 20260519005624 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260519005624 |
| `details` | JSONB | 20260519005624 |
| `id` | UUID | 20260519005624 |
| `performed_by` | UUID | 20260519005624 |

## public.partner_contracts

- Criada em: `20260610215354`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 3.
- Usada em: pages/PartnerContractsAdmin.tsx, pages/PartnerDetail.tsx, pages/PartnerPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `address_city` | text | 20260610215354 |
| `address_complement` | text | 20260610215354 |
| `address_neighborhood` | text | 20260610215354 |
| `address_number` | text | 20260610215354 |
| `address_state` | text | 20260610215354 |
| `address_street` | text | 20260610215354 |
| `address_zip` | text | 20260610215354 |
| `admin_notes` | text | 20260610215354 |
| `bank_account` | text | 20260610215354 |
| `bank_account_type` | text | 20260610215354 |
| `bank_agency` | text | 20260610215354 |
| `bank_name` | text | 20260610215354 |
| `birth_date` | date | 20260610215354 |
| `company_cnpj` | text | 20260610215354 |
| `company_name` | text | 20260610215354 |
| `contract_signed_path` | text | 20260610215354 |
| `contract_template_path` | text | 20260630191752 |
| `contract_template_uploaded_at` | timestamptz | 20260630191752 |
| `contract_uploaded_at` | timestamptz | 20260610215354 |
| `cpf` | text | 20260610215354 |
| `created_at` | timestamptz | 20260610215354 |
| `email` | text | 20260610215354 |
| `form_submitted_at` | timestamptz | 20260610215354 |
| `full_name` | text | 20260610215354 |
| `id` | uuid | 20260610215354 |
| `legal_representative_cpf` | text | 20260610215354 |
| `legal_representative_name` | text | 20260610215354 |
| `legal_representative_role` | text | 20260610215354 |
| `marital_status` | text | 20260610215354 |
| `nationality` | text | 20260610215354 |
| `nda_signed_path` | text | 20260610215354 |
| `nda_template_path` | text | 20260630191752 |
| `nda_template_uploaded_at` | timestamptz | 20260630191752 |
| `nda_uploaded_at` | timestamptz | 20260610215354 |
| `notes` | text | 20260610215354 |
| `partner_id` | uuid | 20260610215354 |
| `person_type` | text | 20260610215354 |
| `phone` | text | 20260610215354 |
| `pix_key` | text | 20260610215354 |
| `profession` | text | 20260610215354 |
| `rg` | text | 20260610215354 |
| `rg_issuer` | text | 20260610215354 |
| `status` | text | 20260610215354 |
| `updated_at` | timestamptz | 20260610215354 |
| `user_id` | uuid | 20260610215354 |
| `whatsapp` | text | 20260610215354 |

## public.partner_documents

- Criada em: `20260703215352`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 1.
- Usada em: components/partner/PartnerDocumentsSection.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20260703215352 |
| `created_by` | uuid | 20260703215352 |
| `description` | text | 20260703215352 |
| `final_path` | text | 20260703215352 |
| `final_uploaded_at` | timestamptz | 20260703215352 |
| `id` | uuid | 20260703215352 |
| `name` | text | 20260703215352 |
| `original_path` | text | 20260703215352 |
| `original_uploaded_at` | timestamptz | 20260703215352 |
| `partner_id` | uuid | 20260703215352 |
| `signed_path` | text | 20260703215352 |
| `signed_uploaded_at` | timestamptz | 20260703215352 |
| `status` | text | 20260703215352 |
| `updated_at` | timestamptz | 20260703215352 |

## public.partner_materials

- Criada em: `20260610215354`
- RLS: sim. Tempo real: não. Políticas: 5. Gatilhos: 2.
- Usada em: pages/PartnerMaterialsAdmin.tsx, pages/PartnerPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | boolean | 20260610215354 |
| `audience` | text | 20260702223604 |
| `category` | text | 20260610215354 |
| `created_at` | timestamptz | 20260610215354 |
| `created_by` | uuid | 20260610215354 |
| `description` | text | 20260610215354 |
| `external_url` | text | 20260610215354 |
| `file_path` | text | 20260610215354 |
| `id` | uuid | 20260610215354 |
| `title` | text | 20260610215354 |
| `updated_at` | timestamptz | 20260610215354 |

## public.partner_products

- Criada em: `20260428160605`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 1.
- Usada em: components/PartnerDetailDrawer.tsx, pages/Products.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | BOOLEAN | 20260428160605 |
| `commission_percent` | NUMERIC(5,2) | 20260428160605 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260428160605 |
| `custom_price` | NUMERIC(12,2) | 20260428160605 |
| `id` | UUID | 20260428160605 |
| `notes` | TEXT | 20260428160605 |
| `partner_id` | UUID | 20260428160605 |
| `product_id` | UUID | 20260428160605 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260428160605 |

## public.partner_support_ticket_messages

- Criada em: `20260630231914`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 3.
- Usada em: components/partner-support/SupportThread.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `attachment_mime` | text | 20260630234838 |
| `attachment_name` | text | 20260630234838 |
| `attachment_path` | text | 20260630234838 |
| `attachment_size` | bigint | 20260630234838 |
| `body` | TEXT | 20260630231914 |
| `created_at` | TIMESTAMPTZ | 20260630231914 |
| `id` | UUID | 20260630231914 |
| `sender_role` | TEXT | 20260630231914 |
| `sender_user_id` | UUID | 20260630231914 |
| `ticket_id` | UUID | 20260630231914 |

## public.partner_support_tickets

- Criada em: `20260630191752`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 3.
- Usada em: components/partner-support/SupportThread.tsx, pages/PartnerDetail.tsx, pages/PartnerPanel.tsx, pages/PartnerSupportAdmin.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `admin_notes` | TEXT | 20260630222847 |
| `admin_responded_at` | timestamptz | 20260630234838 |
| `admin_response` | text | 20260630191752 |
| `assigned_at` | timestamptz | 20260630234838 |
| `assigned_to` | uuid | 20260630234838 |
| `created_at` | timestamptz | 20260630191752 |
| `id` | uuid | 20260630191752 |
| `message` | text | 20260630191752 |
| `partner_id` | uuid | 20260630191752 |
| `priority` | text | 20260630191752 |
| `responded_at` | timestamptz | 20260630191752 |
| `status` | text | 20260630191752 |
| `subject` | text | 20260630191752 |
| `updated_at` | timestamptz | 20260630191752 |
| `user_id` | uuid | 20260630191752 |

## public.partners

- Criada em: `20260428144839`
- RLS: sim. Tempo real: não. Políticas: 5. Gatilhos: 4.
- Usada em: components/clients/tabs/ClientProducts.tsx, components/documents/DocumentDialog.tsx, components/GlobalSearch.tsx, components/goals/ActivityMatrixPanel.tsx, components/PartnerDetailDrawer.tsx, hooks/useReferenceData.ts +7

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | BOOLEAN | 20260428144839 |
| `address_city` | TEXT | 20260630230425 |
| `address_complement` | TEXT | 20260630230425 |
| `address_neighborhood` | TEXT | 20260630230425 |
| `address_number` | TEXT | 20260630230425 |
| `address_state` | TEXT | 20260630230425 |
| `address_street` | TEXT | 20260630230425 |
| `address_zip_code` | TEXT | 20260630230425 |
| `bank_account` | TEXT | 20260506221746 |
| `bank_account_type` | text | 20260703201954 |
| `bank_agency` | TEXT | 20260506221746 |
| `bank_name` | TEXT | 20260506221746 |
| `commission_percent` | NUMERIC(5,2) | 20260428144839 |
| `created_at` | TIMESTAMPTZ | 20260428144839 |
| `default_commission_value` | NUMERIC | 20260506221746 |
| `document` | TEXT | 20260428144839 |
| `email` | TEXT | 20260428144839 |
| `full_name` | TEXT | 20260428144839 |
| `has_system_access` | BOOLEAN | 20260506221746 |
| `id` | UUID | 20260428144839 |
| `is_full_carteira` | boolean | 20260626052438 |
| `notes` | TEXT | 20260428144839 |
| `partner_category` | partner_type_enum | 20260506221746 |
| `partner_type` | public.partner_type | 20260428152947 |
| `phone` | TEXT | 20260428144839 |
| `pix_key` | TEXT | 20260428144839 |
| `profile_locked_at` | timestamptz | 20260703201954 |
| `show_product_name` | boolean | 20260609231532 |
| `updated_at` | TIMESTAMPTZ | 20260428144839 |
| `user_id` | UUID | 20260428144839 |
| `whatsapp` | TEXT | 20260506221746 |

## public.payment_audit_log

- Criada em: `20260702212656`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: components/audit/FinancialAuditPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `actor_email` | text | 20260702212656 |
| `actor_id` | uuid | 20260702212656 |
| `amount` | numeric | 20260702212656 |
| `client_id` | uuid | 20260702212656 |
| `created_at` | timestamptz | 20260702212656 |
| `event` | text | 20260702212656 |
| `id` | uuid | 20260702212656 |
| `new_amount_paid` | numeric | 20260702212656 |
| `new_status` | text | 20260702212656 |
| `old_amount_paid` | numeric | 20260702212656 |
| `old_status` | text | 20260702212656 |
| `payment_id` | uuid | 20260702212656 |
| `sale_id` | uuid | 20260702212656 |
| `source` | text | 20260702212656 |

## public.payments

- Criada em: `20260506231554`
- RLS: sim. Tempo real: sim. Políticas: 3. Gatilhos: 14.
- Usada em: components/clients/ClientFichaTabs.tsx, components/clients/ClientTimelineTab.tsx, components/clients/IntelligentSummary.tsx, components/clients/tabs/ClientFinancial.tsx, components/GlobalSearch.tsx, components/payments/PaymentFormDialog.tsx +15

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | NUMERIC(15, 2) | 20260506231554 |
| `amount_paid` | NUMERIC(15, 2) | 20260506231554 |
| `cancellation_reason` | TEXT | 20260509213159 |
| `client_id` | UUID | 20260506231554 |
| `client_product_id` | UUID | 20260507002225 |
| `collaborator_id` | uuid | 20260520020202 |
| `competence_month` | date | 20260702152518 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506231554 |
| `description` | text | 20260520020202 |
| `due_date` | DATE | 20260506231554 |
| `id` | UUID | 20260506231554 |
| `installment_number` | INTEGER | 20260506231554 |
| `installments_count` | INTEGER | 20260506231554 |
| `is_recurring` | BOOLEAN | 20260509213159 |
| `notes` | TEXT | 20260506231554 |
| `paid_at` | TIMESTAMP WITH TIME ZONE | 20260506231554 |
| `partner_id` | uuid | 20260520020202 |
| `payment_method` | TEXT | 20260506231554 |
| `product_id` | UUID | 20260509213159 |
| `receipt_url` | TEXT | 20260509213159 |
| `recurrence_period` | TEXT | 20260509213159 |
| `referrer_id` | uuid | 20260520020202 |
| `refund_amount` | NUMERIC | 20260509213159 |
| `refunded_at` | TIMESTAMP WITH TIME ZONE | 20260509213159 |
| `sale_id` | UUID | 20260506231554 |
| `status` | public.payment_status | 20260506231554 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506231554 |

## public.product_deduction_templates

- Criada em: `20261103220000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: components/sales/SaleFormDialog.tsx, components/settings/DeductionsSettings.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `deduction_type_id` | uuid | 20261103220000 |
| `fixed_amount` | numeric | 20261103220000 |
| `percent` | numeric | 20261103220000 |
| `product_id` | uuid | 20261103220000 |

## public.product_document_files

- Criada em: `20260701130430`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 2.
- Usada em: components/demands/ProductDocumentFolders.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20260701130430 |
| `file_name` | text | 20260701130430 |
| `file_path` | text | 20260701130430 |
| `file_size` | bigint | 20260701130430 |
| `folder_id` | uuid | 20260701130430 |
| `id` | uuid | 20260701130430 |
| `mime_type` | text | 20260701130430 |
| `uploaded_by` | uuid | 20260701130430 |

## public.product_document_folders

- Criada em: `20260701130430`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 3.
- Usada em: components/demands/ProductDocumentFolders.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_product_id` | uuid | 20260701130430 |
| `created_at` | timestamptz | 20260701130430 |
| `created_by` | uuid | 20260701130430 |
| `id` | uuid | 20260701130430 |
| `name` | text | 20260701130430 |
| `owner_provider_user_id` | uuid | 20260701130430 |
| `scope` | text | 20260701130430 |
| `updated_at` | timestamptz | 20260701130430 |

## public.product_required_documents

- Criada em: `20260507002128`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260507002128 |
| `description` | TEXT | 20260507002128 |
| `id` | UUID | 20260507002128 |
| `is_mandatory` | BOOLEAN | 20260507002128 |
| `name` | TEXT | 20260507002128 |
| `product_id` | UUID | 20260507002128 |

## public.product_steps

- Criada em: `20260507002128`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: components/products/ProductChecklistDialog.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260507002128 |
| `default_due_offset_days` | INTEGER | 20260510050051 |
| `default_responsible` | TEXT | 20260510050051 |
| `description` | TEXT | 20260507002128 |
| `id` | UUID | 20260507002128 |
| `is_visible_to_client` | BOOLEAN | 20260510050051 |
| `name` | TEXT | 20260507002128 |
| `product_id` | UUID | 20260507002128 |
| `step_order` | INTEGER | 20260507002128 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260507002128 |

## public.products

- Criada em: `20260428144839`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 1.
- Usada em: components/clients/AddProductDialog.tsx, components/clients/OperationalChecklist.tsx, components/leads/ConvertLeadDialog.tsx, components/PartnerDetailDrawer.tsx, components/products/ProductFormDialog.tsx, components/provider/ProviderAssignDialog.tsx +5

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | BOOLEAN | 20260428144839 |
| `allow_partner` | BOOLEAN | 20260428150955 |
| `auto_tasks_template` | JSONB | 20260509235732 |
| `avg_delivery_time` | INTEGER | 20260506214504 |
| `base_price` | NUMERIC(14,2) | 20260428144839 |
| `billing_type` | TEXT | 20260506214504 |
| `client_welcome_message` | TEXT | 20260509235732 |
| `created_at` | TIMESTAMPTZ | 20260428144839 |
| `custom_fields_template` | JSONB | 20260509235732 |
| `default_commission_percent` | NUMERIC(5,2) | 20260428144839 |
| `default_contract_template_id` | uuid | 20260520153715 |
| `default_employee_commission` | NUMERIC | 20260506214504 |
| `default_provider_value` | NUMERIC | 20260506214504 |
| `default_sla_days` | INTEGER | 20260509235037 |
| `description` | TEXT | 20260428144839 |
| `doc_allowed_types` | TEXT[] | 20260508184443 |
| `doc_max_size_mb` | INTEGER | 20260508184443 |
| `id` | UUID | 20260428144839 |
| `initial_status` | TEXT | 20260509235732 |
| `installments_count` | integer | 20260520153715 |
| `installments_due_day` | integer | 20260520153715 |
| `installments_entry` | numeric(12 | 20260520153715 |
| `name` | TEXT | 20260428144839 |
| `provider_welcome_message` | TEXT | 20260509235732 |
| `recommended_contract_model_id` | UUID | 20260509235732 |
| `recommended_provider_type` | TEXT | 20260509235732 |
| `recurring` | BOOLEAN | 20260428150955 |
| `required_documents` | JSONB | 20260506214504 |
| `sla_day_type` | TEXT | 20260509235037 |
| `standard_steps` | JSONB | 20260509212425 |
| `updated_at` | TIMESTAMPTZ | 20260428144839 |

## public.profiles

- Criada em: `20260428144839`
- RLS: sim. Tempo real: não. Políticas: 5. Gatilhos: 2.
- Usada em: components/AppSidebar.tsx, components/chat/InternalChat.tsx, components/clients/ClientLinksManager.tsx, components/clients/ClientTimelineTab.tsx, components/clients/IntelligentSummary.tsx, components/clients/tabs/ClientHistory.tsx +22

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | BOOLEAN | 20260506200310 |
| `address_city` | TEXT | 20260506194127 |
| `address_complement` | TEXT | 20260506194127 |
| `address_neighborhood` | TEXT | 20260506194127 |
| `address_number` | TEXT | 20260506194127 |
| `address_state` | TEXT | 20260506194127 |
| `address_street` | TEXT | 20260506194127 |
| `address_zip` | TEXT | 20260506194127 |
| `address_zip_code` | TEXT | 20260506192802 |
| `admission_date` | date | 20260521005548 |
| `avatar_url` | TEXT | 20260428144839 |
| `created_at` | TIMESTAMPTZ | 20260428144839 |
| `department` | text | 20260521005548 |
| `document_number` | TEXT | 20260506194127 |
| `email` | TEXT | 20260428144839 |
| `full_name` | TEXT | 20260428144839 |
| `has_system_access` | BOOLEAN | 20260506234748 |
| `id` | UUID | 20260428144839 |
| `internal_notes` | TEXT | 20260507005812 |
| `manual_approval_required` | BOOLEAN | 20260519005624 |
| `onboarding_completed` | BOOLEAN | 20260519005624 |
| `onboarding_started_at` | TIMESTAMP WITH TIME ZONE | 20260519005624 |
| `onboarding_step` | INTEGER | 20260519005624 |
| `phone` | TEXT | 20260506194127 |
| `position` | text | 20260521005548 |
| `referral_id` | UUID | 20260506192802 |
| `updated_at` | TIMESTAMPTZ | 20260428144839 |

## public.profit_reserves

- Criada em: `20260702144834`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: components/finance/ProfitReservesPanel.tsx, pages/FinanceCenter.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | NUMERIC(14,2) | 20260702144834 |
| `category` | TEXT | 20260702144834 |
| `created_at` | TIMESTAMPTZ | 20260702144834 |
| `created_by` | UUID | 20260702144834 |
| `description` | TEXT | 20260702144834 |
| `id` | UUID | 20260702144834 |
| `name` | TEXT | 20260702144834 |
| `reference_month` | DATE | 20260702144834 |
| `updated_at` | TIMESTAMPTZ | 20260702144834 |

## public.projects

- Criada em: `20260428152947`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 1.
- Usada em: pages/Projects.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | NUMERIC | 20260428152947 |
| `budget` | DECIMAL(12 | 20260506194127 |
| `client_id` | UUID | 20260428152947 |
| `created_at` | TIMESTAMPTZ | 20260428152947 |
| `created_by` | UUID | 20260428152947 |
| `due_date` | DATE | 20260428152947 |
| `id` | UUID | 20260428152947 |
| `name` | TEXT | 20260428152947 |
| `notes` | TEXT | 20260428152947 |
| `partner_id` | UUID | 20260428152947 |
| `priority` | TEXT | 20260506194127 |
| `product_id` | UUID | 20260428152947 |
| `progress` | INTEGER | 20260428152947 |
| `start_date` | DATE | 20260428152947 |
| `status` | public.project_status | 20260428152947 |
| `updated_at` | TIMESTAMPTZ | 20260428152947 |

## public.proposal_items

- Criada em: `20260510052557`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: pages/Proposals.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20260510052557 |
| `description` | text | 20260510052557 |
| `discount` | numeric | 20260510052557 |
| `id` | uuid | 20260510052557 |
| `position` | integer | 20260510052557 |
| `product_id` | uuid | 20260510052557 |
| `product_name` | text | 20260510052557 |
| `proposal_id` | uuid | 20260510052557 |
| `quantity` | numeric | 20260510052557 |
| `total` | numeric | 20260510052557 |
| `unit_price` | numeric | 20260510052557 |

## public.proposals

- Criada em: `20260510052557`
- RLS: sim. Tempo real: sim. Políticas: 2. Gatilhos: 1.
- Usada em: pages/Leads.tsx, pages/Proposals.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `approved_at` | timestamptz | 20260510052557 |
| `client_id` | uuid | 20260510052557 |
| `converted_at` | timestamptz | 20260510052557 |
| `converted_sale_id` | uuid | 20260510052557 |
| `created_at` | timestamptz | 20260510052557 |
| `created_by` | uuid | 20260510052557 |
| `discount` | numeric | 20260510052557 |
| `id` | uuid | 20260510052557 |
| `internal_notes` | text | 20260510052557 |
| `lead_id` | uuid | 20260510052557 |
| `notes` | text | 20260510052557 |
| `payment_terms` | text | 20260510052557 |
| `proposal_number` | text | 20260510052557 |
| `recipient_company` | text | 20260510052557 |
| `recipient_document` | text | 20260510052557 |
| `recipient_email` | text | 20260510052557 |
| `recipient_name` | text | 20260510052557 |
| `rejected_at` | timestamptz | 20260510052557 |
| `rejected_reason` | text | 20260510052557 |
| `sent_at` | timestamptz | 20260510052557 |
| `status` | text | 20260510052557 |
| `subtotal` | numeric | 20260510052557 |
| `total` | numeric | 20260510052557 |
| `updated_at` | timestamptz | 20260510052557 |
| `valid_until` | date | 20260510052557 |
| `viewed_at` | timestamptz | 20260510052557 |

## public.provider_interactions

- Criada em: `20260518082617`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: components/provider/ProviderAtuacao.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `channel` | text | 20260518082617 |
| `client_id` | uuid | 20260518082617 |
| `client_product_id` | uuid | 20260518082617 |
| `created_at` | timestamptz | 20260518082617 |
| `created_by` | uuid | 20260518082617 |
| `direction` | text | 20260518082617 |
| `id` | uuid | 20260518082617 |
| `next_action` | text | 20260518082617 |
| `next_action_at` | timestamptz | 20260518082617 |
| `notes` | text | 20260518082617 |
| `occurred_at` | timestamptz | 20260518082617 |
| `provider_id` | uuid | 20260518082617 |
| `summary` | text | 20260518082617 |
| `updated_at` | timestamptz | 20260518082617 |

## public.provider_schedule

- Criada em: `20260518082617`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: components/provider/ProviderAtuacao.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | uuid | 20260518082617 |
| `client_product_id` | uuid | 20260518082617 |
| `completed_at` | timestamptz | 20260518082617 |
| `completion_notes` | text | 20260518082617 |
| `created_at` | timestamptz | 20260518082617 |
| `created_by` | uuid | 20260518082617 |
| `description` | text | 20260518082617 |
| `id` | uuid | 20260518082617 |
| `priority` | text | 20260518082617 |
| `provider_id` | uuid | 20260518082617 |
| `scheduled_date` | date | 20260518082617 |
| `scheduled_time` | time | 20260518082617 |
| `status` | text | 20260518082617 |
| `title` | text | 20260518082617 |
| `updated_at` | timestamptz | 20260518082617 |

## public.referrers

- Criada em: `20260506154634`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 2.
- Usada em: components/clients/tabs/ClientOverview.tsx, components/clients/tabs/ClientProducts.tsx, hooks/useReferenceData.ts, pages/Commissions.tsx, pages/FinanceCenter.tsx, pages/Indicators.tsx +2

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | boolean | 20260506154634 |
| `commission_percent` | numeric | 20260506154634 |
| `created_at` | timestamptz | 20260506154634 |
| `document` | text | 20260506154634 |
| `email` | text | 20260506154634 |
| `full_name` | text | 20260506154634 |
| `id` | uuid | 20260506154634 |
| `notes` | text | 20260506154634 |
| `phone` | text | 20260506154634 |
| `pix_key` | text | 20260506154634 |
| `updated_at` | timestamptz | 20260506154634 |
| `user_id` | uuid | 20260506154634 |

## public.resource_pool_movements

- Criada em: `20260626051143`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: pages/FinanceCenter.tsx, pages/ResourcePools.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | numeric(14,2) | 20260626051143 |
| `created_at` | timestamptz | 20260626051143 |
| `created_by` | uuid | 20260626051143 |
| `description` | text | 20260626051143 |
| `id` | uuid | 20260626051143 |
| `movement_type` | text | 20260626051143 |
| `occurred_at` | date | 20260626051143 |
| `pool_id` | uuid | 20260626051143 |
| `reference_id` | uuid | 20260626051143 |
| `reference_type` | text | 20260626051143 |

## public.resource_pools

- Criada em: `20260626051143`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 1.
- Usada em: pages/FinanceCenter.tsx, pages/ResourcePools.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | boolean | 20260626051143 |
| `color` | text | 20260626051143 |
| `created_at` | timestamptz | 20260626051143 |
| `created_by` | uuid | 20260626051143 |
| `current_balance` | numeric(14,2) | 20260626051143 |
| `description` | text | 20260626051143 |
| `funding_rule` | jsonb | 20260626051143 |
| `id` | uuid | 20260626051143 |
| `name` | text | 20260626051143 |
| `pool_type` | text | 20260626051143 |
| `project_id` | uuid | 20260626053345 |
| `target_amount` | numeric(14,2) | 20260626051143 |
| `updated_at` | timestamptz | 20260626051143 |

## public.sale_deductions

- Criada em: `20261103220000`
- RLS: sim. Tempo real: sim. Políticas: 1. Gatilhos: 6.
- Usada em: components/sales/SaleFormDialog.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20261103220000 |
| `deduction_type_id` | uuid | 20261103220000 |
| `fixed_amount` | numeric | 20261103220000 |
| `id` | uuid | 20261103220000 |
| `notes` | text | 20261103220000 |
| `payee_id` | uuid | 20261103220000 |
| `percent` | numeric | 20261103220000 |
| `sale_id` | uuid | 20261103220000 |

## public.sale_visibility_overrides

- Criada em: `20261103230000`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: components/sales/SaleFormDialog.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `beneficiary_id` | uuid | 20261103230000 |
| `beneficiary_type` | text | 20261103230000 |
| `sale_id` | uuid | 20261103230000 |
| `see_deductions` | boolean | 20261103230000 |
| `see_gross` | boolean | 20261103230000 |
| `see_payments` | boolean | 20261103230000 |
| `updated_at` | timestamptz | 20261103230000 |

## public.sales

- Criada em: `20260428144839`
- RLS: sim. Tempo real: sim. Políticas: 3. Gatilhos: 18.
- Usada em: components/clients/AddProductDialog.tsx, components/clients/ClientFichaTabs.tsx, components/clients/tabs/ClientFinancial.tsx, components/clients/tabs/ClientProducts.tsx, components/contracts/ContractDialog.tsx, components/documents/DocumentDialog.tsx +14

| Coluna | Tipo | Última alteração |
|---|---|---|
| `amount` | NUMERIC(14,2) | 20260428144839 |
| `cascata_since` | timestamptz | 20261103250000 |
| `client_id` | UUID | 20260428144839 |
| `closed_at` | timestamptz | 20260626053345 |
| `collaborator_id` | uuid | 20260506154634 |
| `collaborator_percent` | numeric | 20260506154634 |
| `commission_percent` | NUMERIC(5,2) | 20260428144839 |
| `created_at` | TIMESTAMPTZ | 20260428144839 |
| `created_by` | UUID | 20260428144839 |
| `deduction_model` | text | 20261103220000 |
| `deduction_review_pending` | boolean | 20261103250000 |
| `first_due_date` | date | 20261103260000 |
| `id` | UUID | 20260428144839 |
| `installments_count` | integer | 20261103260000 |
| `invoice_number` | TEXT | 20260506194127 |
| `notes` | TEXT | 20260428144839 |
| `paid_at` | TIMESTAMP WITH TIME ZONE | 20260506194127 |
| `partner_id` | UUID | 20260428144839 |
| `payment_method` | TEXT | 20260506194127 |
| `product_id` | UUID | 20260428144839 |
| `project_id` | uuid | 20260626062456 |
| `provider_cost` | numeric | 20260609011650 |
| `recurrence_months` | integer | 20260626053345 |
| `recurrence_start` | date | 20260626053345 |
| `referrer_id` | uuid | 20260506154634 |
| `referrer_percent` | numeric | 20260506154634 |
| `resource_pool_id` | uuid | 20260626070729 |
| `revenue_type` | text | 20260626053345 |
| `sale_date` | DATE | 20260428144839 |
| `service_provider_id` | uuid | 20260610213747 |
| `stage_id_at_sale` | uuid | 20260706160017 |
| `status` | public.sale_status | 20260428144839 |
| `updated_at` | TIMESTAMPTZ | 20260428144839 |
| `zenon_cost` | numeric(12 | 20260607033817 |

## public.sales_goals

- Criada em: `20260626051143`
- RLS: sim. Tempo real: sim. Políticas: 1. Gatilhos: 1.
- Usada em: components/dashboard/GoalsPanel.tsx, pages/SalesGoals.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `actual_value` | numeric | 20260701150904 |
| `created_at` | timestamptz | 20260626051143 |
| `created_by` | uuid | 20260626051143 |
| `goal_type` | text | 20260626051143 |
| `id` | uuid | 20260626051143 |
| `notes` | text | 20260626051143 |
| `period_month` | date | 20260626051143 |
| `responsible_id` | uuid | 20260626051143 |
| `target_value` | numeric(14,2) | 20260626051143 |
| `updated_at` | timestamptz | 20260626051143 |

## public.service_assignments

- Criada em: `20260506194127`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 2.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `client_id` | UUID | 20260506194127 |
| `collaborator_id` | UUID | 20260506194127 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506194127 |
| `due_date` | DATE | 20260506194127 |
| `id` | UUID | 20260506194127 |
| `notes` | TEXT | 20260506194127 |
| `product_id` | UUID | 20260506194127 |
| `provider_id` | UUID | 20260506194127 |
| `status` | TEXT | 20260506194127 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506194127 |

## public.service_provider_products

- Criada em: `20260520153715`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 1.
- Usada em: pages/ProductDetail.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | boolean | 20260520153715 |
| `created_at` | timestamp with time zone | 20260520153715 |
| `custom_value` | numeric(12,2) | 20260520153715 |
| `id` | uuid | 20260520153715 |
| `notes` | text | 20260520153715 |
| `product_id` | uuid | 20260520153715 |
| `service_provider_id` | uuid | 20260520153715 |
| `updated_at` | timestamp with time zone | 20260520153715 |

## public.service_providers

- Criada em: `20260506194127`
- RLS: sim. Tempo real: não. Políticas: 7. Gatilhos: 2.
- Usada em: components/clients/tabs/ClientOverview.tsx, components/documents/ClientDocumentFolders.tsx, components/documents/DocumentDialog.tsx, components/GlobalSearch.tsx, components/provider/ProviderAssignDialog.tsx, components/provider/ProviderFormDialog.tsx +11

| Coluna | Tipo | Última alteração |
|---|---|---|
| `active` | BOOLEAN | 20260506194127 |
| `address_city` | text | 20260703212739 |
| `address_complement` | text | 20260703212739 |
| `address_neighborhood` | text | 20260703212739 |
| `address_number` | text | 20260703212739 |
| `address_state` | text | 20260703212739 |
| `address_street` | text | 20260703212739 |
| `address_zip` | text | 20260703212739 |
| `bank_account` | text | 20260703212739 |
| `bank_account_type` | text | 20260703212739 |
| `bank_agency` | text | 20260703212739 |
| `bank_name` | text | 20260703212739 |
| `bio` | text | 20260703212739 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506194127 |
| `document_number` | TEXT | 20260506194127 |
| `email` | TEXT | 20260506194127 |
| `id` | UUID | 20260506194127 |
| `internal_notes` | TEXT | 20260509215653 |
| `internal_rating` | NUMERIC | 20260509215653 |
| `name` | TEXT | 20260506194127 |
| `phone` | TEXT | 20260506194127 |
| `pix_key` | text | 20260703212739 |
| `specialty` | TEXT | 20260506194127 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506194127 |
| `user_id` | UUID | 20260508192402 |
| `whatsapp` | text | 20260703212739 |

## public.signature_stages

- Criada em: `20260703204434`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 1.
- Usada em: components/signatures/SignatureStagesPanel.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `contract_id` | uuid | 20260703204434 |
| `created_at` | timestamptz | 20260703204434 |
| `created_by` | uuid | 20260703204434 |
| `document_id` | uuid | 20260703204434 |
| `file_name` | text | 20260703204434 |
| `file_path` | text | 20260703204434 |
| `file_size` | int | 20260703204434 |
| `id` | uuid | 20260703204434 |
| `mime_type` | text | 20260703204434 |
| `name` | text | 20260703204434 |
| `notes` | text | 20260703204434 |
| `order_index` | int | 20260703204434 |
| `parent_type` | text | 20260703204434 |
| `party` | text | 20260703204434 |
| `status` | text | 20260703204434 |
| `updated_at` | timestamptz | 20260703204434 |
| `uploaded_at` | timestamptz | 20260703204434 |
| `uploaded_by` | uuid | 20260703204434 |

## public.support_ticket_messages

- Criada em: `drizzle 0000`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 1.
- Usada em: components/support/TicketConversation.tsx, components/support/UserSupportCenter.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `body` | text | drizzle 0000 |
| `created_at` | timestamptz | drizzle 0000 |
| `id` | uuid | drizzle 0000 |
| `sender_role` | text | drizzle 0000 |
| `sender_user_id` | uuid | drizzle 0000 |
| `ticket_id` | uuid | drizzle 0000 |

## public.support_tickets

- Criada em: `drizzle 0000`
- RLS: sim. Tempo real: não. Políticas: 3. Gatilhos: 0.
- Usada em: components/support/AdminSupportQueue.tsx, components/support/UserSupportCenter.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `assigned_to` | uuid | drizzle 0000 |
| `category` | text | drizzle 0000 |
| `created_at` | timestamptz | drizzle 0000 |
| `id` | uuid | drizzle 0000 |
| `priority` | text | drizzle 0000 |
| `requester_id` | uuid | drizzle 0000 |
| `requester_role` | text | drizzle 0000 |
| `status` | text | drizzle 0000 |
| `subject` | text | drizzle 0000 |
| `updated_at` | timestamptz | drizzle 0000 |

## public.system_settings

- Criada em: `20260506235128`
- RLS: sim. Tempo real: não. Políticas: 1. Gatilhos: 0.
- Usada em: components/clients/ClientFormDialog.tsx, hooks/useExpenseCategories.ts, hooks/useSystemSettings.ts, pages/DashboardAdmin.tsx, pages/FinanceCenter.tsx, pages/Settings.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `key` | TEXT | 20260506235128 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506235128 |
| `updated_by` | UUID | 20260506235128 |
| `value` | JSONB | 20260506235128 |

## public.task_checklist_items

- Criada em: `20260518103022`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 1.
- Usada em: components/tasks/TaskDetailsExtras.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | timestamptz | 20260518103022 |
| `done_at` | timestamptz | 20260518103022 |
| `done_by` | uuid | 20260518103022 |
| `id` | uuid | 20260518103022 |
| `is_done` | boolean | 20260518103022 |
| `label` | text | 20260518103022 |
| `position` | integer | 20260518103022 |
| `task_id` | uuid | 20260518103022 |
| `updated_at` | timestamptz | 20260518103022 |

## public.task_comments

- Criada em: `20260518103022`
- RLS: sim. Tempo real: não. Políticas: 4. Gatilhos: 1.
- Usada em: components/tasks/TaskDetailsExtras.tsx

| Coluna | Tipo | Última alteração |
|---|---|---|
| `author_id` | uuid | 20260518103022 |
| `content` | text | 20260518103022 |
| `created_at` | timestamptz | 20260518103022 |
| `id` | uuid | 20260518103022 |
| `task_id` | uuid | 20260518103022 |

## public.tasks

- Criada em: `20260506204749`
- RLS: sim. Tempo real: não. Políticas: 12. Gatilhos: 5.
- Usada em: components/clients/ClientFichaTabs.tsx, components/clients/ClientTimelineTab.tsx, components/clients/tabs/ClientTasks.tsx, components/leads/ConvertLeadDialog.tsx, components/leads/LeadFollowUpDialog.tsx, components/tasks/QuickTaskDialog.tsx +8

| Coluna | Tipo | Última alteração |
|---|---|---|
| `assigned_to` | UUID | 20260506204749 |
| `client_id` | UUID | 20260509212834 |
| `client_product_id` | UUID | 20260509212834 |
| `completed_at` | TIMESTAMP WITH TIME ZONE | 20260509212834 |
| `contract_id` | UUID | 20260509212834 |
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506204749 |
| `created_by` | UUID | 20260509212834 |
| `description` | TEXT | 20260509212834 |
| `document_id` | UUID | 20260507002225 |
| `due_date` | TIMESTAMP WITH TIME ZONE | 20260509212834 |
| `duration_minutes` | integer | 20260521011908 |
| `id` | UUID | 20260506204749 |
| `kind` | public.task_kind | 20260521011908 |
| `location` | text | 20260521011908 |
| `meeting_url` | text | 20260521011908 |
| `outcome` | text | 20260521011908 |
| `partner_id` | UUID | 20260509212834 |
| `payment_id` | UUID | 20260509212834 |
| `priority` | task_priority_new | 20260509212834 |
| `provider_id` | UUID | 20260509212834 |
| `related_entity_id` | UUID | 20260506234155 |
| `related_entity_type` | TEXT | 20260506234155 |
| `related_to_id` | UUID | 20260506204749 |
| `related_to_type` | TEXT | 20260506204749 |
| `reminder_minutes` | integer | 20260521011908 |
| `status` | TEXT | 20260506204749 |
| `status_new` | task_status_new | 20260509212834 |
| `title` | TEXT | 20260506204749 |
| `updated_at` | TIMESTAMP WITH TIME ZONE | 20260506204749 |
| `visible_to_client` | boolean | 20260521011908 |

## public.user_permissions

- Criada em: `20260506234748`
- RLS: sim. Tempo real: não. Políticas: 2. Gatilhos: 0.
- Usada em: nenhum acesso direto encontrado

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | TIMESTAMP WITH TIME ZONE | 20260506234748 |
| `granted` | BOOLEAN | 20260506234748 |
| `id` | UUID | 20260506234748 |
| `permission_key` | TEXT | 20260506234748 |
| `user_id` | UUID | 20260506234748 |

## public.user_roles

- Criada em: `20260428144839`
- RLS: sim. Tempo real: não. Políticas: 5. Gatilhos: 0.
- Usada em: components/client/PaymentReceiptDialog.tsx, components/clients/ClientLinksManager.tsx, components/clients/ClientTimelineTab.tsx, components/demands/DemandComments.tsx, components/provider/ProductInteractionPanel.tsx, hooks/useAuth.tsx +7

| Coluna | Tipo | Última alteração |
|---|---|---|
| `created_at` | TIMESTAMPTZ | 20260428144839 |
| `id` | UUID | 20260428144839 |
| `role` | public.app_role | 20260428144839 |
| `user_id` | UUID | 20260428144839 |

