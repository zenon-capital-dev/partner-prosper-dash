
Vou aplicar 3 blocos de mudança. Antes de codar preciso confirmar 2 decisões (estão no fim) porque hoje há **duas tabelas concorrentes** guardando "interações" e é preciso escolher uma antes de contar métrica em cima.

## 1) Metas por atividade (diária / semanal / mensal) — como a planilha

Novo widget **"Metas de Atividade"** dentro de `Metas Comerciais`, no formato da print 1:

```text
                 FEITO   META   FALTA
Abordado           1      60     59
Retorno            1      45     44
Agenda Marcada     1      35     34
Atendido           1      26     25
Fechado            1      15     14
Contrato Assinado  1      10      9
```

- Seletor de período no topo: **Dia | Semana | Mês** (mês continua com o `input[type=month]` já existente).
- Cada linha tem meta editável inline (igual card custom que já existe hoje).
- "Feito" é `COUNT(*)` de interações do período com `kind` = a categoria da linha.
- Barra de progresso e cor (verde ≥100%, âmbar ≥50%, vermelho <50%).

Novas tabelas / colunas:

- `client_interactions.kind text` — enum textual: `abordado | retorno | agenda_marcada | atendido | fechado | contrato_assinado | outro`. Default `outro`. Index em `(kind, occurred_at)`.
- `activity_goals(id, period_kind text, period_start date, kind text, target_value int)` com unique `(period_kind, period_start, kind)`. `period_kind` = `day|week|month`. GRANTs padrão + RLS staff.

## 2) Histórico unificado no cliente + geral

Hoje existem **dois lugares** guardando "interação":

- `client_interactions` (usado no `DailyAgenda` — tem channel, occurred_at, next_action_at, status pendente/concluído).
- `client_timeline` com `event_type` diversos (usado no `ClientDetail` aba "Relacionamento" via `saveInteraction`).

Vou **consolidar em `client_interactions`** (é a tabela desenhada para isso). Mudanças:

- `ClientDetail` aba **Relacionamento** passa a ler/gravar em `client_interactions` (e não mais em `client_timeline`). Formulário de "Novo Registro" ganha os campos: `kind` (select com as 6 categorias + outro), `channel`, `summary`, `occurred_at`, `next_action_at`, `next_action_note`.
- Cada card do histórico mostra: kind (pill colorido) · channel · quando · próxima ação (se houver).
- No topo da aba um mini-resumo do cliente: quantas interações hoje / semana / mês / ano — como você pediu ("resumo de trabalho no dia, semana, mês e ano"), só que por cliente.
- No `Dashboard admin` ganha um card **"Meu trabalho"** com o mesmo resumo mas geral (todas interações do usuário logado). Já existe algo parecido em `DailyAgenda`, vou juntar.

Os registros antigos em `client_timeline` do tipo interação continuam existindo e aparecem em "Histórico" — não migro pra não perder dado.

## 3) "Nova tarefa" na aba Clientes sem sair da aba

Hoje em `src/pages/Clients.tsx` os dois pontos de "Nova tarefa" fazem `navigate("/agenda?new=1&client=…")` — leva pra outra tela.

Troco por: abrir um `TaskFormDialog` inline (já usado em `/tarefas`) com `client_id` pré-preenchido. Ao salvar → toast + invalida cache. Permanece em `/clientes`.

## Ordem de execução

1. Migration: `client_interactions.kind` + `activity_goals` + GRANT + RLS + backfill (`kind='outro'`).
2. Reescreve `ClientDetail` "Relacionamento" pra usar `client_interactions` com o novo formulário.
3. Widget **Metas de Atividade** dentro de `SalesGoals.tsx` (dia/semana/mês) + `activity_goals` CRUD.
4. Card **Meu trabalho** no `DashboardAdmin` (dia/semana/mês/ano).
5. `TaskFormDialog` inline em `Clients.tsx` substituindo os dois `navigate("/agenda?new=1...")`.

## Preciso confirmar antes de codar

1. **`client_timeline` vs `client_interactions`**: OK consolidar tudo em `client_interactions` e deixar `client_timeline` só como log automático de eventos (mudança de estágio, doc aprovado etc.)? Ou você quer manter os dois separados?
2. **Meta semanal**: semana começando **segunda** (padrão BR) — confirma?
