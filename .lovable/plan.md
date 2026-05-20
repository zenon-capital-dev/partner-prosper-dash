# Plano — Aba Comissões (`/comissoes`)

Refatorar `src/pages/Commissions.tsx` para o padrão "claro premium" do admin e corrigir os bugs de filtros, status, ações e tabela de regras. Escopo restrito a este arquivo (e ao retorno de `AllBeneficiariesTable` quando preciso, sem alterá-la).

## Bugs identificados

**Filtros / dados**
- Default `HOJE` filtra por `created_at` e zera quase tudo → percepção de "vazio".
- Filtro por intervalo de datas (`dateFrom`/`dateTo`) usa comparação de string contra `created_at` ISO completo — `c.created_at < dateFrom` quebra quando `dateFrom` é só `yyyy-mm-dd`.
- Filtro de status duplicado (chips no header + Tabs interno) podem dessincronizar visualmente; chips do header só têm 3 opções (TUDO/PENDENTE/PAGO) enquanto Tabs tem 8.
- Status comparado de forma inconsistente: `c.workflow_status === "pendente"` no chip do header, mas há também `aguardando_confirmacao`/`liberada`/`em_pagamento` que ficam fora.
- KPIs usam `workflow_status` mas algumas mutations gravam `status` legado em paralelo (saveEdit, confirmPay) — pode ocorrer divergência se um dos campos não atualizar.
- Busca não normaliza acentos/caixa (`hay.toLowerCase()` só).
- `useDebounce` aplicado no input, mas `useMemo([... search])` usa `search` (não `debouncedSearch`) → debounce ignorado.
- Range "TUDO" usa `new Date(0)` mas comparação ainda passa pelo `if (rangeKey !== "TUDO")`, ok; porém com defaults isolados `dateFrom`/`dateTo` aplicam segundo filtro silencioso quando preenchidos antes.

**Ações / mutations**
- `cancelOne` e `reopenOne` sem `confirmAction` — clique acidental cancela comissão.
- `removeOne` usa `confirmAction(string)` correto, mas outras destructive não seguem o padrão.
- `saveEdit` força `workflow_status = "pago"` mesmo se usuário escolheu `paga`; gera divergência com o enum (que aceita `paga`).
- `createCommission` não exige venda nem produto e o `sale_id` é NOT NULL no banco → INSERT vai falhar com erro genérico quando "Nenhuma" for selecionado. Bug crítico.
- "Pay Dialog" não valida data; permite data futura. Não invalida queries de dashboard/financeiro.
- Botão "Excluir regra" (`Trash2` na tabela de regras) está sem `onClick` — não faz nada.
- Dialog de nova regra sem botão para abrir na UI (`ruleCreateOpen` sem trigger); só dá pra abrir manualmente. Aba "Regras" não tem botão "Nova regra".
- Sem proteção por papel — qualquer um pode criar/pagar/excluir.

**UI / tema**
- Tema com remanescentes escuros/violeta: `bg-slate-900 text-white` nos chips ativos, `bg-warning-muted text-warning`, `bg-success-muted`, `bg-gradient-primary`, `vx-card`, `bg-muted/40`, `font-display`, `vx-mono` — fora do padrão.
- `rounded-2xl/rounded-xl` exagerados e botões `px-6 py-6` enormes — fora do estilo Linear/Attio.
- Tabs internas com 8 status quebra em telas pequenas (sem scroll horizontal).
- Sem chips de filtros ativos removíveis (apenas botão "Limpar (n)").
- Cards KPI no `PageHero` ok, mas KpiCard standalone no fim do arquivo está órfão (definido e não usado).
- Tabela usa `divide-border`, `bg-muted/30`, `text-success`, `bg-warning-muted` etc. — trocar por slate/indigo/emerald/rose/amber.
- Empty state pobre na aba Regras; loading só "Carregando regras...".
- Aba Regras sem busca, sem filtro, sem ordenação, sem edição (só excluir quebrado).
- Sem skeletons.

## Refatoração

1. **Tema claro premium**
   - Raiz `bg-slate-50/60`. Remover todos `bg-[#f8fafc]`, `bg-slate-900`, `vx-card`, `vx-mono`, `font-display`, `bg-gradient-primary`, `bg-warning-muted`, `bg-success-muted`, `divide-border`, `text-success`, `text-warning`, `text-destructive`.
   - Cards `bg-white border-slate-200/70 rounded-lg shadow-sm`.
   - Inter para texto, `font-mono` (JetBrains Mono) para valores/percentuais.
   - Status badges com paleta unificada (slate/amber/indigo/violet/emerald/rose).

2. **Header & filtros de período**
   - Toggle HOJE/7/30/MÊS/TUDO no estilo padrão (`bg-white border-slate-200/70`, ativo `bg-indigo-50 text-indigo-700`).
   - **Default `TUDO`**.
   - Remover chips duplicados (TUDO/PENDENTE/PAGO) do header — manter só o filtro completo no toolbar.
   - Botão "+ Nova comissão" `bg-indigo-600`. Botão extra "+ Nova regra" visível na aba Regras.

3. **KPIs corretos no PageHero**
   - Total filtrado (registros + valor), A pagar (soma de aguardando_confirmacao+pendente+liberada+em_pagamento), Pagas (paga/pago), Canceladas/Estornadas.
   - Taxa de conversão = pagas/(pagas+pendentes filtradas) com guarda de divisão por zero.

4. **Tabs principais (`list` / `all` / `rules`)**
   - Estilo premium: `bg-white border-slate-200/70 rounded-lg p-1`, ativo `bg-indigo-50 text-indigo-700`.
   - Manter `AllBeneficiariesTable` como está (sem editar).

5. **Toolbar do Histórico**
   - Busca normalizada com `norm()` aplicada ao `debouncedSearch`.
   - Selects: Indicador, Status (todos os 8 estados, opção "Todos"), intervalo de datas com inputs limitados.
   - Filtro intervalo corrige comparação (`c.created_at.slice(0,10) >= dateFrom`).
   - Chips de filtros ativos removíveis (cada filtro com um X).
   - Remover Tabs interno de status — duplica o Select.

6. **Tabela de comissões**
   - `SortableTh` em Indicador, Cliente, Valor, %, Comissão, Criada, Status.
   - `PaginationControl` mantido.
   - Empty state diferenciado: "Sem comissões cadastradas" vs "Nenhuma corresponde aos filtros" com CTA para limpar.
   - Skeleton no loading.
   - Dropdown de ações sem cores quentes, hover indigo.
   - Botão Pagar só para status abertos.
   - Bulk actions barra `bg-white border-indigo-200`.

7. **Mutations**
   - `confirmAction` (com `destructive: true` quando aplicável) em: cancelar, reabrir, excluir, bulk cancelar, bulk excluir, marcar pago (validar data ≤ hoje).
   - `createCommission`: exigir `sale_id` (o banco tem NOT NULL); mostrar erro claro se nenhuma venda selecionada. Calcular `client_id`/`product_id` a partir da venda.
   - `saveEdit`: gravar `status` e `workflow_status` consistentes ("pago"/"paga" mapeados). Quando status muda para "cancelada"/"estornada", limpar `paid_at`/`approval_date`.
   - Todas mutations invalidam: `commissions-list`, `dashboard`, `finance-splits`.
   - `removeRule` implementado com `confirmAction` + invalidate `commission-rules`.

8. **Aba Regras**
   - Botão "+ Nova regra" no topo da aba (abre `ruleCreateOpen`).
   - Tabela com mesmas convenções premium, ordenação, busca por parceiro/produto/evento.
   - Ação excluir funcional.

9. **Permissões**
   - `canManage = isAdmin || isAdminSecondary`. Esconder Nova, Editar, Pagar, Cancelar, Excluir, Bulk, Nova regra, Excluir regra para outros papéis.

10. **Polimento**
    - Remover `KpiCard` standalone órfão no fim do arquivo.
    - Remover `selected` quando filtros mudam (limpar seleção).
    - Sincronizar `useDebounce` no `useMemo` de filtragem.
    - Atualizar `font-display`/`vx-mono` → `font-semibold`/`font-mono`.

## Fora de escopo
- `src/components/commissions/AllBeneficiariesTable.tsx` (já existe e funciona).
- Schema do banco, RLS, edge functions, types.

## Arquivo alterado
- `src/pages/Commissions.tsx` (reescrita completa).
