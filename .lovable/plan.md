
## Objetivo

Unificar a linguagem de "fase do cliente" em toda a plataforma usando **um único campo já existente** (`clients.journey_stage_id` → tabela `client_journey_stages`), e permitir que **filtros salvos** por estágio funcionem de forma idêntica em Clientes, Esteira, Vendas, Metas Comerciais, Central Financeira, Dashboard e Painel do Parceiro. Também introduzir "Caixinhas" (reservas de lucro por mês) para debitar do lucro mensal.

---

## Parte 1 — Estágio da jornada como fonte única

Hoje já existe `client_journey_stages` (Prospecção, Captação, Diagnóstico, Proposta enviada, Venda finalizada, Em atendimento, Inativo — configurável pelo usuário em `/esteira`). O campo `clients.journey_stage_id` já existe e a Esteira já usa. Vou **eliminar o campo "status" solto** como filtro de fase e centralizar tudo em `journey_stage_id`.

### 1.1 Clientes (`src/pages/Clients.tsx`)
- Trocar o filtro "Status" atual (ativo/prospecto/novo_cliente/inativo — hardcoded) por **filtro por Estágio da Jornada**, populado dinamicamente de `client_journey_stages`.
- Na ficha do cliente (`ClientDetail`), o `ClientJourneyBadge` já permite mudar o estágio — mudança grava em `clients.journey_stage_id` e invalida cache de todas as telas.
- Manter o campo `status` legado só para retrocompatibilidade (não mais exposto como filtro principal).

### 1.2 Esteira (`src/pages/ClientJourney.tsx`)
- Já usa `journey_stage_id`. Sem mudança de dados — só passa a compartilhar o mesmo `FilterPresets` scope="journey-shared" com Clientes/Vendas/Metas para que filtros salvos por estágio funcionem de forma cruzada.

### 1.3 Vendas (`src/pages/Sales.tsx`)
- Adicionar filtro "Estágio do cliente" (join `sales.client_id → clients.journey_stage_id`).
- Novo KPI: "Receita por estágio" (soma `amount` agrupado por estágio do cliente vinculado).

### 1.4 Metas Comerciais (`src/pages/SalesGoals.tsx`)
- Adicionar filtro por estágio para calcular "vendas realizadas no período contam apenas de clientes em X estágio(s)".
- Mostrar composição da meta por estágio.

### 1.5 Central Financeira (`src/pages/FinanceCenter.tsx`)
- Adicionar filtro por estágio: filtra receitas (pagamentos → vendas → clientes → estágio).
- Novo bloco "Receita por estágio do cliente": Prospecção, Captação, Proposta, Finalizada, Em atendimento, Inativo — com valor recebido + a receber.

### 1.6 Dashboard (`src/pages/DashboardAdmin.tsx` / `Dashboard.tsx`)
- Novo widget "Receita por estágio" (barras) usando o mesmo pipeline.
- O `JourneyMiniWidget` que já existe passa a mostrar também soma financeira ao lado da contagem.

### 1.7 Painel do Parceiro (`src/pages/PartnerPanel.tsx`)
- Aba "Meus clientes" ganha coluna "Estágio" (read-only, mesmo select estilizado) e filtro por estágio.
- Aba "Comissões/Receita" ganha o mesmo bloco "Receita por estágio" restrito aos clientes do parceiro (RLS já garante).

---

## Parte 2 — Filtros salvos compartilhados

Hoje `FilterPresets` guarda em `localStorage` por scope isolado. Vou:

- Criar scope compartilhado **`"stage-shared"`** que salva **apenas o subconjunto de filtros comuns** (estágios selecionados + range de datas + parceiro).
- Cada página mantém seu próprio scope local (filtros específicos) + lê/escreve no `stage-shared` para o que é universal.
- No dropdown de filtros salvos, marcar com ícone "🔗 Compartilhado" os presets do escopo global — aplicá-los em qualquer página traz automaticamente estágios + datas + parceiro; filtros específicos daquela página ficam como estavam.

Fluxo: usuário cria em Clientes o preset "Prospecção Q2" (estágios: Prospecção+Captação, datas: abr–jun). Ao abrir Esteira, Vendas, Metas, Financeira, Dashboard ou Painel do Parceiro, esse mesmo preset aparece no dropdown e aplica os filtros equivalentes.

---

## Parte 3 — Caixinhas (reservas de lucro por mês)

Nova funcionalidade dentro da Central Financeira.

### 3.1 Banco (migração)
Tabela `profit_reserves` (Caixinhas):
- `name` (ex.: "Escritório", "Reserva de emergência")
- `amount` (valor a debitar)
- `reference_month` (mês de competência — ex.: 2026-05-01)
- `description`, `category`, `created_by`
- + timestamps padrão + GRANTs + RLS (admin/finance role gerencia).

### 3.2 UI (`src/pages/FinanceCenter.tsx`)
- Novo bloco "Caixinhas" com botão "+ Nova caixinha": abre dialog para criar (nome, valor, mês de competência, descrição).
- Lucro do mês passa a ser calculado como: `receita_recebida - despesas - Σ caixinhas do mês`.
- Card "Lucro líquido" mostra tooltip com breakdown das caixinhas descontadas naquele mês.
- Lista abaixo mostra todas as caixinhas com filtro por mês, edição e exclusão.

---

## Parte 4 — Ordem de execução

1. Migração `profit_reserves` (aguarda aprovação).
2. Refatorar `Clients.tsx`: filtro Status → Estágio da jornada (dinâmico).
3. Adicionar filtro por Estágio em `Sales.tsx`, `SalesGoals.tsx`, `FinanceCenter.tsx`, `PartnerPanel.tsx`.
4. Adaptar `FilterPresets.tsx` para suportar scope compartilhado `stage-shared` + scope local.
5. Adicionar bloco "Receita por estágio" em Financeira, Dashboard, Painel do Parceiro.
6. Implementar Caixinhas: dialog + lista + integrar no cálculo de lucro.
7. Verificar por Playwright: mudar estágio de um cliente em `/clientes/:id` → confirmar reflete em `/esteira`, `/vendas` (KPI), `/metas`, `/financeiro/central`, `/dashboard`, `/parceiro`.

---

## Detalhes técnicos

- Nenhuma alteração em `clients.status` (mantido para retrocompat).
- Toda leitura de estágio usa `client_journey_stages` (já existe hook `useQuery(["journey-stages-mini"])`).
- Filtros salvos compartilhados usam chave `localStorage: filter-presets:stage-shared:v1` com forma `{ stageIds: string[], from?: string, to?: string, partnerId?: string }`.
- Caixinhas: função Postgres `monthly_profit(month date)` retorna `receita - despesas - reservas` para uso no Dashboard.
- RLS de `profit_reserves`: apenas usuários com role admin/finance (via `has_role`).

---

## Fora do escopo (não farei agora)

- Renomear/remover campo legado `clients.status` (só deixa de ser filtro).
- Migrar dados históricos de `status` para `journey_stage_id` automaticamente — usuário faz manualmente ou pedimos um passo de mapeamento depois se quiser.
