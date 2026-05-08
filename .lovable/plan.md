## Objetivo
Estruturar a delegação de produtos a prestadores com acesso restrito por produto, completar o painel do parceiro (comissões + contrato + financeiro) e criar o painel do prestador com reporte de status que aparece no admin.

---

## 1. Delegação de Prestador por Produto do Cliente

**Modelo de dados (já existe parcialmente)**
- `client_products` já tem `service_provider_id` / `responsible_provider_id`. Vamos consolidar em `service_provider_id` como o prestador delegado.
- Adicionar tabela `client_product_status_reports` para o prestador reportar status (pendente_documentos, em_análise, aguardando_cliente, concluído, etc.) com observações e timestamp.

**Acesso a documentos (RLS)**
- Hoje `documents` está vinculado a `client_id`. Vamos adicionar `client_product_id` (já existe coluna em `payments`, replicar lógica).
- Nova policy em `documents`: prestador (role `prestador`) só vê documentos cujo `client_product_id` aponte para um `client_products.service_provider_id` que casa com seu `service_providers.user_id`.
- Mesma regra para `document_requests`.

**UI Admin**
- Na ficha do cliente → aba Produtos: botão "Delegar Prestador" por produto, abre dialog com select de prestadores.
- Mostrar prestador atual + último status reportado.

---

## 2. Painel do Prestador (`/prestador`)

Tabs:
- **Meus Clientes**: lista de `client_products` onde `service_provider_id = eu`. Cada card mostra cliente, produto, status atual, prazo.
- **Documentos**: vê só documentos dos produtos delegados a ele (via RLS).
- **Reportar Status**: abre modal por cliente/produto, escolhe status + observação → grava em `client_product_status_reports` e atualiza `client_products.status`.

**Notificações**
- Ao reportar status, dispara notificação aos admins (já temos `notify_admins`).

---

## 3. Painel Admin — Visão de Status dos Prestadores

- Nova seção em `/projetos` ou aba no Dashboard: "Status reportados pelos prestadores" com filtro por prestador / produto / status.
- Na ficha do cliente, timeline já existe — adicionar eventos de reporte.

---

## 4. Painel do Parceiro (`/parceiro`) — Completar

Tabs:
- **Meus Clientes Indicados**: lista de `clients` onde `partner_id = eu` (já existe, refinar).
- **Comissões**: tabela com filtros por status (pendente, pago, cancelado), via `commission_splits` filtrada para `beneficiary_type='partner'` e `beneficiary_id = meu partner.id`. Resumo de saldo, pendente, pago, cancelado.
- **Meu Contrato**: visualização + download do contrato do parceiro com a empresa (vamos usar `contracts` com flag/categoria `partner_contract` — adicionar coluna `contract_kind` enum).
- **Financeiro**: extrato de pagamentos das comissões + saldo consolidado.

---

## 5. Detalhes Técnicos

**Migração SQL**
- `ALTER TABLE documents ADD COLUMN client_product_id UUID REFERENCES client_products(id);`
- `ALTER TABLE document_requests ADD COLUMN client_product_id UUID REFERENCES client_products(id);`
- `CREATE TABLE client_product_status_reports (id, client_product_id, reported_by, status, notes, created_at)`.
- `ALTER TABLE contracts ADD COLUMN contract_kind TEXT DEFAULT 'cliente';` (cliente | parceiro)
- Novas RLS para prestador em `documents`, `document_requests`, `client_products`, `client_product_status_reports`.
- Trigger: ao inserir status report → notifica admins + atualiza `client_products.status`.

**Frontend**
- `src/pages/ProviderPanel.tsx` — reescrever com tabs e queries scopadas.
- `src/pages/PartnerPanel.tsx` — adicionar tabs Comissões / Contrato / Financeiro.
- `src/components/clients/tabs/ClientProducts.tsx` — botão "Delegar Prestador" + status reports.
- Novo dialog `DelegateProviderDialog.tsx` e `ReportStatusDialog.tsx`.
- Tudo com tokens do design system (sem cores hardcoded).

---

## Entrega em 2 lotes

**Lote A** — Delegação + Painel do Prestador (migração + UI prestador + UI admin de delegação)
**Lote B** — Painel do Parceiro completo (comissões filtradas, contrato, financeiro)

Posso começar pelo Lote A?
