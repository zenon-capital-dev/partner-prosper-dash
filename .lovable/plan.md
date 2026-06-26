
# Plano — Tópicos 11 a 15

## 11 · Faturamento recorrente vs avulso (na cabeça)

**Banco — migração:**
- `sales`: adicionar `revenue_type` (`avulso` | `recorrente`, default `avulso`), `recurrence_months` (int, nulo p/ avulso), `recurrence_start` (date, default = data de finalização).

**Formulário de venda (`SaleFormDialog`):**
- Toggle "Tipo de receita": Avulso (na cabeça) / Recorrente (mensal).
- Se recorrente: campos "Quantos meses" (ex.: 12 p/ concierge) e "Início da cobrança".
- Gerador de `payments` passa a criar N parcelas mensais para recorrentes (uma por mês do período), em vez do parcelamento atual.

**Cronograma de faturamento (`FinanceCenter` → "Mapa de receitas"):**
- Cada mês mostra três linhas: **Recorrente do mês**, **Avulso (na cabeça)**, **Total previsto**.
- Card de KPI separado: "MRR previsto" vs "Receita avulsa do mês".

## 12 · Vendas — coluna Ações à esquerda do Status

- Em `src/pages/Sales.tsx` reordenar colunas da tabela: ... Cliente · Produto · Valor · **Ações** · **Status** · Data.
- Mesma reordenação na versão mobile (cards).

## 13 · Dashboard de metas + página geral + status "fechado"

**Página geral de metas (`/metas-comerciais`):**
- Reformular para alimentar metas de **cada mês**: seletor de mês + grid editável com linhas para cada tipo:
  - Faturamento total, MRR (recorrente), Receita avulsa (na cabeça)
  - Captação de clientes (mês / semana / dia — derivado automaticamente do mensal)
  - Atendimentos realizados
  - Clientes fechados
- Mostra previsto × realizado e % atingido.

**Widget no dashboard (`Dashboard`):**
- Novo card "Metas do mês" com mini barras dos principais indicadores e link "Ver todas".

**Status do cliente:**
- Adicionar opção "Fechado" no select de status do cliente (enum já tem `finalizado`; basta expor com rótulo "Fechado" e considerar em filtros e KPIs).

## 14 · Venda só conta quando finalizada

- Realizado das metas e KPIs financeiros passam a usar apenas `sales.status = 'finalizada'` filtrando por `closed_at` (nova coluna preenchida no momento em que o status vira finalizada — via trigger).
- `created_at` / `sale_date` deixam de ser usados em dashboard, mapa de receitas, metas e gráfico de faturamento.
- "Mapa de receitas" passa a alocar a venda no mês de `closed_at` (avulso) ou a distribuir nos meses de recorrência a partir de `recurrence_start`.

## 15 · Caixinha de Projetos

**Banco:**
- `resource_pools`: adicionar `project_id` (FK opcional p/ `projects`) e novo `pool_type = 'projeto'`.
- (Alternativa cogitada e descartada: criar tabela nova — reaproveitar `resource_pools` mantém saldo e movimentações já prontos.)

**UI (`ResourcePools`):**
- Filtro/visão "Por projeto" agrupando as caixinhas vinculadas a projetos.
- Ao criar caixinha tipo "projeto", selecionar o projeto associado (ex.: Escritório, Aluguel, Colaborador).
- Card de cada projeto mostra: meta, arrecadado até agora, % batido, botões de entrada/saída.

**Página de Projetos:**
- Bloco "Caixinha do projeto" na ficha do projeto, exibindo saldo e últimos movimentos da pool linkada.

## Detalhes técnicos

- Migração única cobrindo `sales` (3 colunas + trigger `closed_at`), `resource_pools` (`project_id`) e índice em `sales(closed_at, revenue_type)`.
- `SaleFormDialog`: refator do gerador de `payments` para suportar dois modos (parcelado avulso × mensal recorrente).
- Hook `useDashboardStats`: trocar base de cálculo para `closed_at`.
- Tipos do select de status do cliente: mapa `finalizado → "Fechado"` na camada de apresentação.
- Sem mudança em RLS — todas as tabelas afetadas já têm policies cobrindo os novos campos.

## Fora de escopo

- Disparo de e-mail ou cobrança automática das parcelas recorrentes (usuário pediu para ignorar e-mail).
- Conciliação bancária / integração com gateway.
