## Objetivo

Deixar a aba **Tarefas** (`/tarefas` → `src/pages/Tasks.tsx`) funcionando "perfeito": filtros que mostram resultados reais, responsável aparecendo, calendário sem bug de fuso, ações claras (concluir/excluir/editar) e estados vazios úteis.

Tabela `tasks` está **vazia hoje (0 linhas)** — então boa parte da sensação de "nada funciona" vem do filtro padrão **HOJE** aplicado em `created_at`, que esconde qualquer tarefa criada em outro dia. Vou corrigir isso junto com os bugs reais.

## Bugs identificados

1. **Filtro de período aplicado em `created_at`** — esconde tarefas com prazo no período se foram criadas antes. Deveria filtrar por `due_date` (prazo), e "TUDO" como padrão até existir volume.
2. **Padrão "HOJE"** com banco vazio = lista sempre vazia, sem CTA claro.
3. **Responsável nunca aparece** — `TaskRow` lê `task.assigned_user.full_name`, mas o `select` da query não faz join com `profiles`. Resultado: nome do responsável invisível em lista/kanban/calendário.
4. **Bug de fuso no calendário** — `dayKey` usa `toISOString()` (UTC), então uma tarefa com prazo 20/05 23:00 BRT aparece em 21/05 no calendário. `tasksByDate` tem o mesmo problema ao quebrar `due_date.split("T")[0]` quando o ISO já está em UTC.
5. **Salvar prazo via `new Date(yyyy-mm-dd).toISOString()`** — interpreta como meia-noite UTC e grava no dia anterior em BRT.
6. **Sem contador nas abas Lista/Kanban/Calendário** e bloco de KPI duplicado escondido com `className="hidden ..."` (código morto).
7. **Sem ação rápida "Concluir"** na linha — usuário precisa abrir o select de status só para marcar como feito.
8. **Sem confirmação visual ao excluir** consistente (usa `confirmAction` custom; ok, manter, mas garantir toast).
9. **Diálogo de criar/editar** sem feedback de loading, sem reset ao trocar `entity_type`, e select de "Item vinculado" lista até 500 sem busca — ok manter, mas adicionar aviso quando lista grande.
10. **Kanban e Lista não dizem que filtros estão ativos** quando o resultado é zero — empty state genérico engana o usuário.

## Mudanças

Tudo em `src/pages/Tasks.tsx` (sem migração, sem mexer em RLS):

1. **Query**: adicionar join `assigned_user:profiles!tasks_assigned_to_fkey(id, full_name)` no select principal (com fallback já existente preservado).
2. **Filtro de período**: passar a usar `due_date` em vez de `created_at`. Tarefas **sem prazo** entram em "TUDO" e também em "HOJE" (para ficarem visíveis em vez de sumirem). Mudar **padrão para "TUDO"** já que é uma central de tarefas e o time precisa ver tudo por padrão.
3. **Helpers de data sem TZ**:
   - `toLocalDateKey(d: Date | string)` → `yyyy-MM-dd` usando `format(d, "yyyy-MM-dd")` (date-fns local).
   - `tasksByDate` e `dayKey` usam o helper.
   - Ao salvar `due_date`, gravar como `${form.due_date}T12:00:00` (meio-dia local) para evitar virada de dia em qualquer fuso.
4. **TaskRow**:
   - Mostrar responsável de fato (`task.assigned_user?.full_name`).
   - Botão rápido ✓ "Concluir" quando `status_new !== "concluida"`, ou ↺ "Reabrir" quando concluída/cancelada.
   - Badge de "Sem prazo" quando `due_date` é nulo.
5. **Tabs**: adicionar contador em cada `TabsTrigger` (Lista = total filtrado, Kanban = idem, Calendário = total com prazo).
6. **KPIs**: remover bloco oculto duplicado (linhas 412–424).
7. **Estados vazios**:
   - Se `tasks.length === 0` → CTA "Criar primeira tarefa".
   - Se filtrado vazio mas existem tarefas → "Nenhuma tarefa nos filtros atuais" + botão "Limpar filtros".
8. **Diálogo**:
   - Botão "Salvar/Criar" com estado `saving` (disable + texto "Salvando...").
   - Ao trocar `entity_type` para "none", limpar `entity_id` (já faz).
   - Aviso "Mostrando os primeiros 500. Refine pela aba do cliente para ver outros." abaixo do select quando a lista de vinculados tiver 500 itens.
9. **Kanban**: ao clicar no card, abrir editor (já faz); manter, mas reduzir colunas em telas médias e mostrar contador de "0" em cinza.

## Detalhes técnicos

- Sem alteração no schema, RLS ou edge functions.
- `due_date` continua `timestamptz`; o ajuste é só na serialização ao enviar (`${date}T12:00:00.000`).
- Join novo depende do FK `tasks.assigned_to → profiles.id`. Se o nome do constraint divergir, o `select` cai no fallback existente, então a tela continua funcionando.
- Sem dependência nova de pacote.

## Fora de escopo

- Drag-and-drop no Kanban (pode entrar em uma próxima rodada).
- Notificações/automação ao concluir.
- Filtro por responsável (posso incluir se você quiser, basta avisar).
