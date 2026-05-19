# Continuação — CRUD completo + máscaras + sincronização

Pego de onde paramos. Foco em garantir que **criar, vincular, editar, salvar e apagar** funcione 100% em todas as entidades, com máscaras profissionais e propagação correta entre admin/colaborador/parceiro/prestador.

## 1. Finalizar máscaras BR em todos os formulários

Já criei `src/lib/masks.ts`, `src/lib/validators.ts` e `src/components/ui/masked-input.tsx`. Falta aplicar:

- `ClientFormDialog` — CPF/CNPJ (auto-detect), telefone, CEP com **auto-fill ViaCEP** (preenche rua/bairro/cidade/UF). Salvar apenas dígitos no banco.
- `LeadFormDialog` — telefone, WhatsApp.
- `CompanyFormDialog` — CNPJ, telefone, CEP + ViaCEP.
- `ProviderFormDialog` — CPF/CNPJ, telefone.
- `Partners.tsx`, `Collaborators.tsx`, `Indicators.tsx` (formulários inline) — CPF/CNPJ, telefone.
- `Perfil.tsx`, `ClientOnboarding.tsx` — telefone, documento, CEP.

## 2. Auditoria de CRUD — fluxo end-to-end

Vou rodar cada operação manualmente no banco e validar:

**Criar:**
- Cliente com colaborador + parceiro + prestador → checar que `clients.collaborator_id`, `partner_id`, `referrer_id`, `service_provider_id` ficam preenchidos.
- Trigger `propagate_client_collaborator` propaga para `client_products.responsible_employee_id`.
- Demanda nova herda `responsible_employee_id` via `fill_client_product_responsible`.
- Task nova herda `assigned_to` via `fill_task_assigned_from_demand`.
- Venda gera comissão via `handle_new_sale` + splits via `generate_commission_splits`.

**Editar:**
- Trocar colaborador de um cliente já existente → propaga para demandas órfãs/desse colaborador (trigger já faz, validar).
- Editar lead e converter → garante que `responsible_id` vai pra `clients.collaborator_id` e `client_products.responsible_employee_id`.

**Apagar / Arquivar:**
- `Products.handleDelete` já trata FK (feito).
- Replicar mesma lógica para: **Clientes** (verificar `sales`, `client_products`, `contracts`, `payments`, `documents` → desativar se vinculado, deletar se órfão), **Leads** (deletar limpo, sem FK pesada), **Parceiros/Prestadores/Colaboradores/Indicadores** (desativar via `active=false` se tem vínculo, deletar se órfão).
- Adicionar confirmação clara com contagem de vínculos antes de qualquer destrutivo.

**Visualização cruzada:**
- Cliente criado por admin com colaborador X → aparece em `/colaborador` (Dashboard, Minhas Demandas, Clientes, Tarefas).
- Cliente vinculado a parceiro Y → aparece em `/parceiro`.
- Demanda delegada a prestador Z → aparece em `/prestador`.
- Comissão gerada → aparece em `/colaborador/comissoes`, `/parceiro/comissoes`, `/indicador`.

Cada gap encontrado vira correção imediata (migration de RLS, ajuste de query, ajuste de trigger).

## 3. Padronizar handlers CRUD

Criar helpers reutilizáveis:

- `src/lib/safe-delete.ts` — `safeDelete({ table, id, fkChecks: [{ table, column }] })` que retorna `{ canDelete, blockedBy }` e oferece fallback de desativar.
- `src/lib/format-display.ts` — `formatCPFCNPJ`, `formatPhone`, `formatCEP` para exibir formatado em listas/cards (dados salvos em dígitos puros).

Aplicar nos botões Excluir de: `Clients.tsx`, `Leads.tsx`, `Partners.tsx`, `Providers.tsx`, `Collaborators.tsx`, `Indicators.tsx`, `Sales.tsx`, `Contracts.tsx`.

## 4. Smoke test de RLS + fluxo

Criar `src/test/rls/end-to-end-flow.test.ts` que usa `SUPABASE_SERVICE_ROLE_KEY` (skip se ausente):

1. Cria 2 colaboradores (A, B)
2. Como admin: cria cliente vinculado a A, cria demanda, cria task, cria venda
3. Loga como A → vê cliente, demanda, task, comissão
4. Loga como B → **não** vê nada
5. Como admin: troca responsável para B
6. Loga como B → agora vê; A não vê mais

Adicionar script `npm run test:rls`.

## 5. Polish visual do Leads e ClientFormDialog

(O que já tinha sido prometido no plano anterior)

- `/admin/leads`: header com busca proeminente, filtros como chips removíveis, segmented control Kanban/Tabela, cards do Kanban com avatar + badge de origem + valor mono + footer com idade.
- `ClientFormDialog`: virar **wizard de 3 passos** (Dados → Endereço/Documentos → Vínculos+Acesso) com stepper, validação por passo, resumo no último.
- `LeadFormDialog`: wizard 2 passos (Contato → Qualificação).

---

## Ordem de execução

1. Aplicar máscaras em todos os forms (item 1) + ViaCEP
2. Criar `safe-delete.ts` e aplicar em Clientes, Parceiros, Prestadores, Colaboradores, Indicadores, Leads (item 3)
3. Auditar fluxo CRUD via queries SQL e corrigir gaps (item 2)
4. Wizard nos dialogs de Cliente e Lead + polish do Leads (item 5)
5. Smoke test RLS (item 4)
6. QA mobile 375px nas telas refeitas

Posso seguir?