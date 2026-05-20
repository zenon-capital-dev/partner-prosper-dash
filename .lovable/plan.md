## Problemas identificados no Dashboard Admin

### 1. Gráfico mostra dias errados (bug principal)
- `brasiliaToday` é criado como data local, mas `toISO(d)` usa `d.toISOString().slice(0,10)` — isso converte para UTC e **desloca a data em ±3h**, fazendo o eixo X marcar o dia errado (especialmente à noite/madrugada em Brasília).
- O comprimento do gráfico é fixo (HOJE = 14, 7D = 14, 30D/MÊS = 30), ignorando o filtro:
  - "HOJE" mostra 14 dias (deveria mostrar hoje, idealmente por hora ou um único ponto).
  - "MÊS" sempre 30 dias, mesmo no dia 5.
- As barras do gráfico mostram `valor = somatório das vendas com sale_date === iso`, mas como o `iso` está deslocado, vendas de hoje aparecem em "ontem".

### 2. Falta painel "Hoje" / pendências do dia
- Não existe um quadro que liste o que precisa ser feito **hoje**: tarefas com vencimento hoje, demandas com deadline hoje, documentos solicitados, contratos aguardando assinatura, comissões a liberar.

### 3. Conferência de outras informações
- Cards operacionais (demandas atrasadas, contratos abertos, docs, tarefas, comissões) já existem e batem com o banco — vou só revalidar os filtros de status após corrigir o problema de data.

---

## Plano de correção

### A. Corrigir o gráfico (eixo X e período)
1. Trocar `toISO` por uma função que formata data **local** (`YYYY-MM-DD` via `getFullYear/getMonth/getDate`), não `toISOString`. Isso elimina o deslocamento de fuso.
2. Tornar o comprimento do gráfico dinâmico:
   - HOJE → 1 ponto (hoje) ou últimos 7 dias rotulados para contexto — vou usar **últimos 7 dias** destacando hoje, mais útil que 1 ponto solto.
   - 7D → 7 dias.
   - 30D → 30 dias.
   - MÊS → do dia 1 até hoje.
3. Atualizar o subtítulo "Performance comercial" para refletir o range real.
4. Garantir que `sale_date` (que vem como `YYYY-MM-DD` do Postgres) é comparado com a string local — sem `new Date()` intermediário.

### B. Adicionar card "Hoje" (pendências do dia)
Novo card no topo, antes da seção operacional, com 4 listas curtas (até 5 itens cada) + contagem:

```text
┌───────────────────────────────────────────────┐
│  HOJE · quarta, 20 de maio                    │
│  [3] Tarefas    [2] Demandas    [1] Doc    [0]│
│                                                │
│  Tarefas vencendo hoje                         │
│   • Ligar João — 14:00         → /tarefas      │
│   • Revisar contrato Acme      → /tarefas      │
│                                                │
│  Demandas com prazo hoje                       │
│   • Cliente X · Produto Y      → /demandas/.. │
│                                                │
│  Docs aguardando análise                       │
│   • Cliente Z — RG             → /documentos   │
└───────────────────────────────────────────────┘
```

Queries (usando dados já carregados):
- **Tarefas hoje**: `tasks` onde `due_date` (date local) === hoje e `status` ∉ {concluida, completed}.
- **Demandas hoje**: `client_products` onde `deadline` === hoje e `status` ∈ {em_andamento, aguardando_inicio}.
- **Documentos pendentes**: `document_requests` com status `enviado` ou `em_analise` (precisam da minha ação).
- **Contratos aguardando**: `contracts` com status `aguardando_assinatura` ou `enviado` (apenas contagem).

Cada item linka para a página correspondente. Se a lista estiver vazia, mostrar "Nenhuma pendência — você está em dia 🎉".

### C. Validar dados restantes
- Confirmar que filtros de demand status usam `concluida`/`cancelada` (e não `concluido`) — vou alinhar com o enum real do banco enquanto edito.
- Não vou mexer em RLS, schema, ou outras páginas — só `src/pages/DashboardAdmin.tsx`.

---

## Arquivos afetados
- `src/pages/DashboardAdmin.tsx` (único arquivo editado)

## Fora de escopo
- Outras páginas, schema, RLS, triggers, dashboard de prestador/colaborador/cliente.