# Filtro de estágio global + seletor inline em Vendas

## Objetivo

- Ter **um único filtro de estágio da esteira** reutilizável, presente em Clientes, Vendas, Metas Comerciais, Demandas e Esteira.
- Poder mudar o estágio de um cliente **direto do card/linha em qualquer aba** (não só em Clientes), sem abrir o dossiê.
- Toda alteração reflete em tempo real nas outras abas.
- Não perder histórico: Metas continuam medindo corretamente mesmo quando o estágio muda depois.

## O que muda

### 1. Componente único de filtro `StageFilter`

Novo `src/components/filters/StageFilter.tsx` — chip com contador + dropdown multi-seleção de estágios (busca `client_journey_stages` uma única vez, cache global). Usado em:

- Clientes (substitui o filtro atual)
- Vendas — filtra pelo estágio **atual do cliente** da venda
- Metas Comerciais — mesmo filtro, aplicado sobre as vendas usadas no cálculo
- Demandas — filtra pelo estágio do cliente da demanda
- Esteira — já usa estágios, só padroniza o visual

### 2. Seletor inline em Vendas

- No menu de ações "..." de cada venda (o mesmo da print) adiciono um sub-item **"Mover estágio →"** com a lista de estágios.
- No card/linha, ao lado do badge do parceiro, mostro uma pílula pequena com o estágio atual (mesmo componente `InlineStageSelect` já corrigido em Clientes), portalizado, sem abrir a venda.
- Mudar por ali atualiza `clients.journey_stage_id` do cliente da venda → reflete em Clientes, Demandas, Esteira e Metas automaticamente (invalidação de cache já existe em `invalidateJourneyStageCaches`).

### 3. "Itens por página" onde falta

- Padronizar `PaginationControl` (10/25/50/Todos) em Vendas, Metas, Demandas e Leads — hoje algumas abas não têm ou não persistem a escolha.

### 4. Histórico de estágio (para Metas não mentirem)

Hoje `clients.journey_stage_id` é sobrescrito. Se uma venda foi fechada em Junho quando o cliente estava em "Prospecção" e hoje está em "Ativo", a Meta de Junho mostra "Ativo" — errado.

Solução: **snapshot do estágio no momento da venda**.

- Adicionar coluna `stage_id_at_sale uuid` em `sales` (nullable, sem FK obrigatória).
- Preencher automaticamente no insert/update (trigger) com o `journey_stage_id` atual do cliente quando a venda é marcada como `concluida`.
- Metas passam a agrupar/filtrar por `stage_id_at_sale` (fallback para o estágio atual se null, para vendas antigas).
- Já existe a tabela `client_stage_history` — uso ela para auditoria e para reconstruir estágio "na data X" se você quiser relatórios retroativos depois.

Assim: mudar o estágio **agora** não altera o número histórico de Junho, mas altera o filtro de Clientes/Vendas em aberto. É o comportamento correto de CRM.

## Detalhes técnicos

- `StageFilter` recebe `value: string[]`, `onChange`, opcional `showCounts` que conta ocorrências no dataset atual.
- `InlineStageSelect` (já refeito com shadcn Select portalizado) é reusado em Vendas — só passo `clientId` da venda.
- Migração:
  ```sql
  ALTER TABLE public.sales ADD COLUMN stage_id_at_sale uuid;
  -- trigger BEFORE INSERT/UPDATE que copia clients.journey_stage_id
  -- quando NEW.status = 'concluida' e stage_id_at_sale IS NULL
  ```
- Invalidação: qualquer mudança de estágio invalida `["clients"]`, `["sales"]`, `["demands"]`, `["goals"]`, `["client-stage-map"]`.

## Ordem de execução

1. Criar `StageFilter` e trocar em Clientes (baseline visual).
2. Migração `stage_id_at_sale` + trigger.
3. Vendas: filtro no topo + `InlineStageSelect` no card e no menu "...".
4. Metas: trocar filtro interno pelo `StageFilter`, usar `stage_id_at_sale`.
5. Demandas e Esteira: aplicar `StageFilter`.
6. `PaginationControl` (10/25/50/Todos) onde falta.
7. Teste manual: mudar estágio em cada aba e conferir reflexo nas outras + número da Meta do mês anterior não muda.

## Ponto que preciso confirmar

Para a Meta, o snapshot deve travar **quando a venda vira `concluida`** (minha proposta) ou **na data em que a venda foi criada**? A primeira é a que faz sentido pra faturamento; confirma?
