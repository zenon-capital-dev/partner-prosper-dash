## Objetivo

Deixar a aba **Prazos** (`/sla` → `src/pages/SLAPages.tsx`) realmente útil: filtros consistentes, ordenação por urgência, texto certo, fuso correto e ações claras nos cards.

Banco hoje: **3 demandas em andamento**, todas com prazo a 30+ dias → todas caem em "No Prazo". As abas "Atrasadas / Vencem hoje / Em atenção" ficam vazias, e o usuário sente "tudo bugado". Vou consertar os bugs reais e melhorar a leitura para que esse cenário fique evidente em vez de parecer quebrado.

## Bugs e problemas identificados

1. **Texto desatualizado no card "Como o SLA é calculado"** — diz que "Atenção" aparece com menos de 30% do prazo, mas o código (`src/lib/sla.ts`) usa `<= 2 dias`. Confunde o usuário.
2. **Sem ordenação por urgência** — a query ordena por `sla_due_date asc`, mas dentro do bucket não há critério visível; demandas "atrasadas há 10 dias" ficam misturadas com "atrasadas há 1 dia".
3. **`isToday(due)` e exibição do prazo** com `toISOString()` introduzem off-by-one em fuso BRT (mesmo bug que corrigi em Tarefas/Atuações). Hoje BRT 23h ISO já é amanhã.
4. **Bucket "Pausado"** depende de `status === "pausado"`, mas o KPI "Pausado" no array `stats` também — ok. Faltam concluídas reaparecerem como filtro opcional (hoje a query exclui `concluido` cego).
5. **Sem ação rápida no card** — clique no card inteiro navega para o detalhe (ok), mas não há botão claro "Abrir demanda" — usuários com mouse hesitante não percebem.
6. **KPIs do PageHero não são clicáveis** — para trocar de bucket o usuário precisa rolar até as abas.
7. **Ranking de prestadores** não é clicável; deveria filtrar a lista por aquele prestador.
8. **Sem filtro por prestador** explícito.
9. **Empty state genérico** — não distingue "banco vazio" de "sem resultado neste bucket".
10. **Demandas sem `sla_due_date`** somem do ranking e da contagem (calculateSLA retorna null/"—") sem aviso.
11. **`avgDaysOver`** usa `daysRemaining` (já negativo) e aplica `Math.abs` — ok, mas se houver apenas 1 atrasado, o número diz "0d" quando deveria mostrar "1d" no mínimo arredondado.

## Mudanças (somente `src/pages/SLAPages.tsx`)

1. **Ordenar `filtered`** por urgência: `daysRemaining` ascendente (atrasados primeiro), `null` no fim.
2. **Fuso seguro** ao formatar `dueDate` — usar `format(dueDate, "dd/MM/yyyy")` direto (date-fns local) em vez de `formatDate(dueDate.toISOString())`.
3. **KPIs clicáveis** no PageHero — passar `onClick` que troca o `bucket` (Atrasadas → `atrasado`, Vence Hoje → `vence_hoje`, On-Time → `no_prazo`).
4. **Card do prestador no ranking** vira botão: clicar filtra a lista pelo nome do prestador (via novo state `providerFilter`); chip removível "Filtrando: PrestadorX ×" acima da lista.
5. **Adicionar filtro de "Sem prazo"** como bucket extra (`sem_prazo`) — pega `sla?.daysRemaining == null && sla?.status !== 'pausado'`. Conta no KPI lateral também.
6. **Botão "Abrir" no card** (visível no hover em desktop, sempre visível no mobile) — usa o mesmo `navigate`. O card inteiro continua clicável.
7. **Atualizar o texto** do card "Como o SLA é calculado" para refletir o código: "Status 'Em atenção' aparece quando faltam 2 dias ou menos para o prazo".
8. **Empty state diferenciado**:
   - `demands.length === 0` → "Sem demandas ativas no momento" + link para `/demandas`.
   - filtrado vazio com demands existentes → "Nenhuma demanda neste filtro" + botão "Ver todas".
9. **Indicador de "Sem prazo"** em cards: badge `Sem prazo definido` quando `sla?.daysRemaining == null`.
10. **`avgDaysOver` `Math.max(1, ...)`** quando há atrasado para nunca mostrar `0d` enganoso.

## Detalhes técnicos

- Sem migração, sem mudança em `src/lib/sla.ts`, sem mudança em RLS.
- Reaproveita `useNavigate`, `Input`, `Badge`, `Skeleton` já importados.
- Novo state local: `providerFilter: string | null`.
- Sem nova dependência.

## Fora de escopo

- Mudar o cálculo de SLA (`src/lib/sla.ts`) — comportamento atual mantido.
- Página de auditoria/histórico de atrasos.
- Notificações automáticas para prestadores atrasados.
