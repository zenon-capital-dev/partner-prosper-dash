## Objetivo

Deixar a aba **Clientes** (`/clientes` → `src/pages/Clients.tsx`) consistente com o tema claro do admin e sem os bugs que dão sensação de "nada funciona".

Banco hoje: **3 clientes**, todos `ativo` → KPI "Em risco" = 0, todos os filtros restritivos esvaziam a lista. Boa parte da queixa vem disso somado a problemas reais de UX. Vou consertar os bugs e melhorar a leitura.

## Bugs e problemas identificados

1. **Tema fora do padrão admin claro** — cards usam `bg-card/40 border-border/60 text-foreground`, que vão escuros e quase invisíveis. A memória core do projeto exige cards `bg-white border-slate-200/70 rounded-lg shadow-sm` no admin. Cards e tabela precisam ser portados para o tema claro premium.
2. **Skeleton errado em modo Cards** — durante o `isLoading` em `view="grid"` aparece `TableSkeleton` (linhas de tabela) em vez de skeletons de cards.
3. **`dateRange.to` não inclui o dia inteiro** — `createdAt > dateRange.to` filtra fora cadastros do próprio dia `to`. Deveria usar `endOfDay(dateRange.to)`.
4. **`filtered` lista `search` nas deps em vez de `debouncedSearch`** (linha 185) → recomputa duas vezes a cada tecla.
5. **`currentPage` não reseta ao alternar view** — pode ficar em página > totalPages quando troca de Cards (12/pg) para Tabela e o total filtrado mudar entre renders.
6. **Botão "NOVO CLIENTE"** com `py-6` desproporcional comparado ao resto (h-12 nos outros). Quebra a barra do hero.
7. **Sem chips visuais de filtros ativos** — o usuário precisa abrir o painel de filtros para descobrir o que está aplicado.
8. **Tabela sem ordenação** — não dá para clicar nos cabeçalhos para ordenar por nome, receita, cadastro etc.
9. **Tooltip/badge "Em risco"** sempre 0 em base pequena sem explicação de como o cálculo é feito.
10. **`SummaryCard` (linha 709)** é dead code — nada importa nem usa.
11. **`overdue`** usa `new Date(due_date) < new Date()` — quando `due_date` é uma data sem hora, sofre fuso e marca como vencido o dia de hoje. Substituir por comparação por dia local.
12. **Pesquisa por documento** filtra com `c.document?.includes(q)` — não considera CNPJ/CPF formatado vs cru. Buscar "12345678" não acha "12.345.678". Normalizar removendo pontuação.
13. **Foco no input de busca perdido** ao recarregar `enriched` (não é bug grave; sem ação).
14. **Sem indicador de "página 1 de N" quando não há resultado** — `PaginationControl` pode mostrar 0 de 0 ou esconder; verificar e garantir não-renderização quando vazio (provavelmente já trata; não mudar a menos que necessário).

## Mudanças (somente `src/pages/Clients.tsx`)

1. **Tema claro premium**:
   - Cards de cliente: `bg-white border-slate-200/70 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300`.
   - Container de tabela: `bg-white border-slate-200/70`.
   - Cabeçalho da tabela: `bg-slate-50/70 text-slate-500`.
   - Texto principal: `text-slate-900`; muted: `text-slate-500`.
   - Manter o accent indigo no avatar e badges; remover `bg-card/40`, `border-border/60` desta página.
2. **Skeleton coerente com a view** — em `view="grid"`, renderizar 12 placeholders de card (`Skeleton` h-56). Em `view="table"`, manter `TableSkeleton`.
3. **`endOfDay` no `dateRange.to`** antes da comparação.
4. **Trocar dep `search` → `debouncedSearch`** no `useMemo` `filtered`.
5. **Resetar `currentPage` ao trocar view**.
6. **Botão "NOVO CLIENTE"** → `h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider` (mesma altura do botão "Limpar").
7. **Chips de filtros ativos** abaixo da toolbar quando houver pelo menos 1, cada um com botão `×` para remover; chip extra para `search`. Botão "Limpar tudo".
8. **Ordenação na tabela** — adicionar `sortKey: "name" | "revenue" | "created" | "health"` e `sortDir: "asc" | "desc"`; cabeçalhos viram botões com seta `↑/↓`. Sem ordenação aplicada no modo Cards.
9. **Tooltip "Em risco"** explica o cálculo: "Saúde < 50 (pagamentos vencidos, inatividade ou baixo pagamento relativo)".
10. **Remover `SummaryCard` dead code**.
11. **`overdue`** passa a usar `startOfDay(parseISO(due_date)) < startOfToday()`.
12. **Normalizar busca por documento** — remover não-dígitos da query e do `c.document` antes do `includes`. Manter busca por nome/email/telefone/empresa como está.

## Detalhes técnicos

- Sem migração, sem mudança em RLS, sem mudança em `ClientDetail.tsx`.
- Sem nova dependência (uso de `date-fns` já presente).
- `confirmAction` e fluxo de delete/archive não mudam — apenas o visual.
- `useDebounce(search, 400)` mantido.
- Mantém respeito a `canWrite = isAdmin || isAdminSecondary` (memória core: colaborador é read-only nesta tela).

## Fora de escopo

- Seleção em massa / arquivar vários ao mesmo tempo.
- Persistir filtros na URL.
- Mudança no cálculo de health/risco (lógica de negócio mantida).
- Tela `ClientDetail` (já vista em outras rodadas).
