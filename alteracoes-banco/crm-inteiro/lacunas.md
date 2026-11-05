# Lacunas do CRM

O que falta, o que está em risco e quem resolve. Levantamento de 04/11/2026, feito sobre o repositório. O banco real só se confirma com `conferir-crm-inteiro.sql`.

## 1. Banco: migrations pendentes

**Quem resolve:** dono do CRM, pelo Lovable.

| Ordem | Migration | Evidência | Instruções |
|---|---|---|---|
| 1 | `20261103260000_numero_unico_parcelas_metas.sql` | `sales.first_due_date`, `sales.installments_count`, `sales_goal_actuals` e `regenerate_sale_payments` não estão no `types.ts` | [ver](../20261103260000-numero-unico.md) |
| 2 | `20261104120000_fluxo_de_caixa.sql` | 6 tabelas e 12 funções `cash_*` não estão no `types.ts` | [ver](../20261104120000-fluxo-de-caixa.md) |

O código da `main` já chama esses objetos. Depois de aplicar, o `types.ts` precisa ser gerado de novo.

## 2. Banco: migration que nunca pode ser repetida

**Quem resolve:** ninguém precisa fazer nada, só não repetir.

`20260521201011_6b0fd385-df71-4df6-8ca3-d525ae8f1b8f.sql` esvazia as tabelas operacionais com `TRUNCATE` e remove usuários. Foi a única migration com `TRUNCATE` ou com `DELETE` sem `WHERE` encontrada.

## 3. Banco: objetos que só existem em `drizzle/migrations/0000`

**Quem resolve:** nada a aplicar agora. Não apagar.

`drizzle/migrations/0000_collab_fk_doc_shares_support.sql` não tem cópia em `supabase/migrations/`, e a migration `20261024160000` depende dele. Se o banco um dia for recriado só com `supabase/migrations/`, isto se perde:

- **Tabelas:** `document_shares`, `support_tickets`, `support_ticket_messages`.
- **Funções:** `public.provider_has_document_share`, `public.provider_can_read_shared_file`, `public.notify_provider_on_document_share`, `public.on_support_message`.
- **Gatilhos:** `trg_notify_provider_document_share`, `trg_on_support_message`.
- **Chaves estrangeiras** de `collaborator_id` em `clients`, `sales` e `client_collaborators`.

## 4. Banco: pastas de arquivos sem migration

**Quem resolve:** dono do CRM, pelo Lovable, só se o script apontar `FALTA` em `pasta`.

O código usa cinco pastas que têm políticas de acesso, mas nenhuma migration as cria: `partner-materials`, `partner-contracts`, `expense-receipts`, `product-documents` e `signature-stages`. Provavelmente foram criadas fora das migrations. Sem a pasta, o envio de arquivos daquela tela falha.

Rodar somente se faltar. O comando não altera pasta que já existe. Todas são privadas, porque o código não usa `getPublicUrl`:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES
  ('partner-materials', 'partner-materials', false),
  ('partner-contracts', 'partner-contracts', false),
  ('expense-receipts', 'expense-receipts', false),
  ('product-documents', 'product-documents', false),
  ('signature-stages', 'signature-stages', false)
ON CONFLICT (id) DO NOTHING;
```

## 5. Banco: telas esperando atualização em tempo real

**Quem resolve:** decisão do usuário antes de qualquer mudança.

Estas tabelas têm telas ouvindo mudanças em tempo real, mas nenhuma migration as publica. Se também não estiverem publicadas no banco, a tela só atualiza ao recarregar.

| Tabela | Tela |
|---|---|
| `chat_messages` | `InternalChat.tsx`. Foi **retirada de propósito** na migration `20260511232018` |
| `activity_goals` | `ActivityGoalsPanel.tsx` |
| `client_interactions` | `ActivityGoalsPanel.tsx` |
| `client_support_ticket_messages` | `ClientSupportTab.tsx` |
| `demand_comments` | `DemandComments.tsx` |
| `demand_request_messages` | `DemandRequestsPanel.tsx` |
| `product_document_files` | `ProductDocumentFolders.tsx` |
| `product_document_folders` | `ProductDocumentFolders.tsx` |

Para ver quais estão publicadas no banco:

```sql
SELECT tablename FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime'
 ORDER BY tablename;
```

## 6. Código: consultas a colunas que não existem

**Quem resolve:** correção no código, sem mudança no banco. **Ainda não corrigido.**

Essas colunas não existem nas migrations nem no `types.ts`:

| Arquivo | O que pede | O que existe | O que acontece |
|---|---|---|---|
| `src/pages/ProviderPanel.tsx:422` | `notifications.read_at` e `kind` | `read` e `type` | A consulta falha sem aviso, e as notificações recentes do prestador ficam vazias |
| `src/components/clients/tabs/ClientOnboardingTab.tsx:74` | `profiles.onboarding_status` | só em `clients` | Ligar ou desligar o acesso do cliente falha, porque o erro é lançado antes de atualizar `clients` |
| `src/pages/Proposals.tsx:596` | `leads.name` | `full_name` | A lista de leads nesse formulário de proposta fica vazia |
| `supabase/functions/invite-user/index.ts:93` | `service_providers.full_name` | `name` | Os vínculos de prestador não aparecem na lista de usuários. Corrigir também a linha 111 |

O comportamento foi deduzido da leitura do código, sem testar no site.

## 7. Backup do menu do sistema não é backup do banco

**Quem resolve:** dono do CRM. Antes de aplicar qualquer migration, fazer o backup direto no banco.

`src/lib/full-backup.ts` exporta planilhas de 18 das 113 tabelas. Ficam de fora, por exemplo, o livro de caixa, as deduções e as políticas, funções e gatilhos.

## 8. Migrations com laços dinâmicos

**Quem resolve:** nada a aplicar.

Estas migrations criam objetos por laços, então o mapa não lista cada um. É esperado que alguns apareçam como `SO NO BANCO`:

| Migration | O que faz |
|---|---|
| `20260508030227` | Liga RLS e cria a política "Admins total access" nas tabelas que existiam na data |
| `20260511052024` | Cria gatilhos `update_<tabela>_updated_at` em tabelas principais |
| `20260511233653` | Reescreve políticas para usar funções privadas |
| `20260701001200` | Cria chaves estrangeiras e índices |
| `20261024160000` | Troca a restrição de `documents.source` |

## 9. Tabelas sem acesso direto no código

**Quem resolve:** nada a fazer. **Não apagar por causa desta lista.**

Podem estar em uso por funções, gatilhos ou por telas que escolhem a tabela em tempo de execução: `activities`, `client_collaborators`, `client_referrers`, `client_subscriptions`, `document_history`, `employees`, `onboarding_history`, `product_required_documents`, `service_assignments` e `user_permissions`. `client_subscriptions` e `employees` aparecem no backup do sistema.
