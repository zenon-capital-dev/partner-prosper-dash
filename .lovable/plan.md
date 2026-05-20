# Plano — Aba Faturamento (`/financeiro`)

Refatorar `src/pages/Finance.tsx` para o padrão "claro premium" das demais abas e corrigir os bugs que fazem dados sumirem ou aparecerem errados. Escopo restrito a este arquivo.

## Bugs identificados

**Dados/KPIs**
- KPIs "A RECEBER (7D)" e "INADIMPLÊNCIA" hard-coded em `R$ 0,00` — não calculam nada.
- Receita filtra `status === "concluida" || "pago"`, mas o enum real de `sales.status` é `pendente | concluida | cancelada` (pagamento controlado por `paid_at`). Resultado: receita pode inflar/zerar dependendo do dado.
- Filtro de despesas só aplica `gte`, nunca `lte` (`to` ignorado) — despesas fora do período aparecem.
- `commission_splits` filtra por `created_at`, não por `paid_at` — comissões pagas em outro período entram indevidamente; e o range "TUDO" funciona, mas "HOJE" zera tudo silenciosamente (default ruim).
- `commissionsPaid` compara `status === "pago"`, mas o enum `split_status` é `pendente | pago | cancelado` — ok, mas `commissionsTotal` soma TODOS (inclusive cancelados); `cancelado` deve ser excluído.
- `netCommission` é calculado mas nunca exibido; "Saldo Líquido" usa `profit = receita − comissões − despesas`, label "Margem Final" idem; KPIs duplicam o que está no card abaixo.
- Gráfico fixo em 30 dias ignorando o range selecionado; usa `s.status === 'concluida'` (sem considerar `paid_at`); soma comissões mesmo as canceladas.

**UI/UX**
- Tema escuro/violeta misturado (`dark:bg-[#060608]`, `bg-slate-900`, `dark:bg-white`) — fora do padrão claro premium do admin.
- Botões de período com visual pesado (`bg-slate-900 text-white`), incoerente com sidebar/Cards atuais.
- Cards `rounded-[24px]` com `bg-indigo-600` enorme — destoa do `rounded-lg shadow-sm` padrão.
- Sem tabela de despesas, sem tabela de vendas, sem listagem de comissões — só gráfico. Usuário não consegue auditar nada.
- Sem ações de editar/excluir despesa, sem proteção por papel (`isAdmin`).
- Dialog "Nova Despesa" sem campo Categoria visível (só no state), sem validação de data futura, sem `confirmAction` na exclusão.
- Sem busca, sem filtros, sem export CSV, sem skeleton, sem empty state.
- `<Tabs>` importado mas nunca renderizado (`tab`/`setTab` órfãos).

## Refatoração

1. **Tema claro premium**
   - Raiz: `bg-slate-50/60` (sem `dark:`).
   - Cards: `bg-white border border-slate-200/70 rounded-lg shadow-sm`.
   - Inter para texto, JetBrains Mono para números/valores.
   - Remover todo `dark:`, `bg-[#060608]`, `bg-slate-900`, `rounded-[24px]`, `vx-card`.

2. **Header & período**
   - `PageHero` com eyebrow "Tesouraria", título "Faturamento", ícone `PiggyBank`.
   - Toggle de período HOJE/7/30/MÊS/TUDO no estilo dos outros (`bg-white border-slate-200/70`, ativo `bg-indigo-50 text-indigo-700`).
   - **Default `TUDO`** (HOJE zera quase tudo e gera percepção de bug).
   - Botão "+ Nova Despesa" `bg-indigo-600` no `actions`.

3. **KPIs corretos (5 cliques navegam para abas internas)**
   - Receita Bruta = soma `sales.amount` onde `status='concluida'` (e dentro do período por `sale_date`).
   - A Receber = soma `sales.amount` onde `status='pendente'` e `sale_date` no período.
   - Despesas = soma `expenses.amount` no período (corrigir filtro `lte`).
   - Comissões Pagas / A Pagar = `commission_splits` por `paid_at` (pagas) e `created_at` (pendentes), excluindo `cancelado`.
   - Lucro Líquido = Receita − Comissões pagas − Despesas. Margem = Lucro/Receita.
   - Cada KPI clicável muda a tab interna.

4. **Tabs internas (responsivas, com contagem)**
   - Visão Geral (gráfico + alertas).
   - Vendas (tabela `sales` com cliente/produto/valor/status/data, busca normalizada, `SortableTh`, `PaginationControl`, export CSV).
   - Despesas (tabela com categoria/data/valor, criar/editar/excluir com `confirmAction`, somente admin).
   - Comissões (tabela `commission_splits` agrupada por beneficiário, status, valor, com filtro pago/pendente).
   - Relatórios (resumo mensal últimos 3/6/12 meses: receita, despesas, comissões, lucro, margem; export CSV).

5. **Gráfico Fluxo de Caixa**
   - Buckets respeitam o range selecionado (dia para HOJE/7/30, dia do mês para MÊS, mês para TUDO).
   - Receita usa `sale_date` quando `status='concluida'`; comissões usam `paid_at` e ignoram `cancelado`; despesas usam `expense_date`.
   - Cores: `indigo-600` (receita), `rose-500` (despesas), `amber-500` (comissões). Tooltip com `formatBRL`.

6. **Banner de alertas**
   - `bg-amber-50 border-amber-200/70` quando: despesas > receita do período, ou comissões pendentes > X, ou inadimplência alta. Cada alerta tem link para a tab correspondente.

7. **Dialog "Nova/Editar Despesa"**
   - Campos: descrição, categoria (Select: Operacional, Marketing, Pessoal, Impostos, Outros), valor (BRL mask), data.
   - Validação: valor > 0, data ≤ hoje.
   - Edição reaproveita o mesmo dialog.
   - Exclusão via `confirmAction`.
   - Cross-invalidate: `finance-sales`, `finance-expenses`, `finance-splits`, `dashboard`.

8. **Permissões**
   - `canManage = isAdmin || isAdminSecondary`. Ações de criar/editar/excluir despesa, marcar comissão paga, etc. ocultas para demais papéis.

9. **Polimento**
   - Skeleton durante load; empty state diferenciado ("Sem dados no período" vs "Sem vendas cadastradas").
   - Chips de filtros ativos removíveis (período, busca, categoria).
   - Busca com `norm()` (sem acento/caixa) em cliente, produto, descrição.

## Fora de escopo
- Schema do banco, RLS, `types.ts`, edge functions.
- Páginas `FinanceCenter.tsx` (já refatorada), `Dashboard*`, `Reports.tsx`.
- Fluxos de pagamento/recebimento via gateway.

## Arquivo alterado
- `src/pages/Finance.tsx` (reescrita completa).
