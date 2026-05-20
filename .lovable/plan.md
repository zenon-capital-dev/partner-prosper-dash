# Consertar aba Atuações (/atuacoes)

A página `src/pages/Atuacoes.tsx` tem bugs reais de layout e fluxos incompletos. Hoje a tabela `daily_actions` está vazia (0 linhas) — então parte do "nada funciona" é porque não há dado, mas além disso a UI tem problemas estruturais.

## Bugs identificados

1. **Layout quebrado** — o wrapper `max-w-[1600px] mx-auto px-5 lg:px-8` (linha 199) fecha na linha 228, mas a **lista de atuações** e os **dialogs** ficam FORA dele. Resultado: a lista vai até a borda da tela, sem padding, encostada no topo.
2. **`<Tabs>` sem `<TabsContent>`** — os tabs trocam o estado mas a lista é renderizada num bloco solto fora do `Tabs`. Funciona "por acaso" via `tab` state, mas o foco/aria/animação dos tabs não funciona.
3. **Search mal posicionado** — fica numa linha separada abaixo dos tabs, ao invés de ao lado.
4. **Counters só nas duas primeiras tabs** — "Próximas" e "Histórico" não mostram contagem.
5. **Comparação de data com timezone** — `isToday(parseISO("2025-05-20"))` pode dar resultado errado dependendo do fuso. Usar comparação por string `yyyy-MM-dd` resolve.
6. **Histórico sem filtros** — não tem filtro por resultado nem período, vira lista infinita.
7. **Não dá para excluir** uma atuação (só cancelar) nem **reabrir** uma cancelada.
8. **Reagendar** dispara mutação no primeiro clique do calendário, sem confirmação nem feedback.
9. **Diálogo "Nova atuação"** — busca de cliente só por nome (não pega empresa); limita silenciosamente em 50 sem aviso; sem opção de criar atuação sem produto fica enxuto, mas falta validação visual de cliente obrigatório.
10. **Cancelar** não pede confirmação.

## O que vou ajustar (somente UI/queries, sem migração)

### Estrutura
- Envolver toolbar + tabs + search + lista + dialogs **dentro de um único** `max-w-[1600px] mx-auto px-5 lg:px-8 space-y-4`.
- Mover `<TabsContent value="hoje|atrasadas|proximas|historico">` para conter a lista corretamente.
- Tabs e search **na mesma linha** (`flex items-center justify-between gap-3`).

### Tabs / contadores
- Adicionar badge de contagem também em "Próximas" e "Histórico".

### Comparação de datas
- Trocar `isToday/isPast(parseISO(...))` por comparação direta `a.scheduled_date === todayStr` / `< todayStr` usando `format(new Date(), "yyyy-MM-dd")`. Elimina qualquer timezone shift.

### Histórico
- Adicionar **filtro de resultado** (todos/contatado/sem_resposta/fechado/reagendar) e **período** (7d/30d/tudo) no topo da tab.

### Ações da linha
- Adicionar item "Excluir" (com `AlertDialog` de confirmação) que dispara `DELETE` em `daily_actions`.
- Para cancelar: trocar `window.confirm` implícito por `AlertDialog`.
- Para **executadas/canceladas**: adicionar botão "Reabrir" que volta status para `pendente` e zera `result/execution_notes/executed_at`.

### Reagendar
- Trocar dialog para incluir botão "Confirmar nova data" — só dispara mutação após confirmação. Calendar fica preview.

### Criar atuação
- Busca de cliente em `or(full_name.ilike.%q%, company.ilike.%q%)`.
- Mensagem clara quando a lista atinge 50 resultados ("Refine a busca para ver mais").
- Bloquear botão "Agendar" enquanto não há cliente, com mensagem de hint.

### Estado vazio
- Já existe; manter mas no estado "hoje" sem nenhuma atuação mostrar CTA mais claro.

## Arquivos afetados
- `src/pages/Atuacoes.tsx` (refator de layout + filtros + novas ações)

Nenhuma alteração de banco ou RLS é necessária — `daily_actions` já tem policies `Admins manage daily actions` (ALL) e `Internal team views daily actions` (SELECT), o que permite todas as operações que vou expor.
