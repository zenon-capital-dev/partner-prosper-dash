## Central Financeira — padrão claro premium

Refatorar `src/pages/FinanceCenter.tsx` no mesmo padrão das abas Parceiros, Prestadores, Indicadores, Colaboradores, Contratos e Arquivos. Sem mexer em RLS, schema, edge functions, nem em `process-alerts`.

### Bugs identificados a corrigir

**Dados e lógica**
- `CashFlow` e `Reports` comparam `c.workflow_status === "paga"` mas `markPaid` salva `"pago"` — comissões pagas não aparecem nos gráficos.
- `CommissionsTable` mistura `status`/`workflow_status` com valores `pago`/`paga`, inconsistente.
- `kpis.netCommission = totalReceived - commissionsPaid` (na verdade é Receita líquida, não Comissão líquida) — label errado.
- KPI "A receber" ignora parcial corretamente, mas o "Vencido" só conta abertos; nada destaca parcial vencido.
- Filtro de status do `PaymentsTable` usa `_status` recalculado mas o Select não tem `parcialmente_pago` separado de `parcial`, nem `reembolsado` cobre todos cenários.
- `markPaid` confirma com `amount_paid = amount` mesmo quando já havia valor parcial pago, sobrescrevendo histórico.
- `cancelPayment`/`refundPayment` usam `window.prompt` nativo (UI feia, sem validação).
- Sem proteção de papel: qualquer usuário pode confirmar/cancelar/reembolsar pagamento e marcar comissão paga.
- Aba "Por cliente" não mostra pagamentos vencidos do cliente nem permite ação inline.
- Sem invalidação de queries cruzadas (`dashboard`, `client-payments`, `commissions-rich`).
- `Reports` agrupa por `paid_at` mas inclui null silenciosamente; quando ausente, parcela some.
- Busca não normaliza acento, ignora método de pagamento, parcela, recorrência.

**UI/UX**
- Tabs em fila única quebram em mobile; sem indicador de contagem por aba.
- Sem filtros de período (HOJE/7/30/MÊS/TUDO) na visão global — só dá pra ver tudo.
- Sem chips de filtros ativos, sem "Limpar filtros".
- Sem ordenação de coluna nem paginação nas tabelas grandes.
- Sem export CSV.
- Cards usam `bg-card` (legado) em vez do padrão claro premium.
- Cores: `bg-blue-500/15`, `bg-rose-500/15` etc — alinhar à paleta consistente do admin.
- Sem skeleton; empty state genérico ("Nada encontrado").

### Escopo da refatoração

1. **Header & KPIs claros**
   - PageHero claro com 5 KPIs **clicáveis** (Recebido, A receber, Vencido, Comissões a pagar, Receita líquida — label corrigido).
   - Botão "Atualizar alertas" no estilo `bg-indigo-600` secundário.
   - Filtro global de período (HOJE/7/30/MÊS/TUDO, default **TUDO**) aplicado a KPIs e tabelas.

2. **Banner de alertas** — card claro `bg-amber-50 border-amber-200/70`, com link "Ver todos" para a aba inadimplência.

3. **Abas premium** — `Tabs` com contagem por aba (ex: "Contas a receber (12)"), responsivo (rolagem horizontal no mobile), ícones, estado ativo `bg-indigo-50 text-indigo-700`.

4. **PaymentsTable** (Receitas, Recebidos, A receber, Inadimplência)
   - Busca normalizada (`norm()` sem acento) em cliente/empresa/produto/método/parcela.
   - Filtros: Status (todos os valores válidos), Método de pagamento, Recorrência (sim/não), Datas (de/até).
   - Chips de filtros ativos + "Limpar tudo" + contador "Mostrando X de Y".
   - `SortableTh` por Cliente, Produto, Valor, Vencimento, Parcela, Status.
   - `PaginationControl`.
   - Ações restritas a `canManage = isAdmin || isAdminSecondary`:
     - Confirmar pagamento → diálogo premium com campo `amount_paid` editável e data, somando ao parcial existente.
     - Cancelar → `confirmAction` com motivo obrigatório (Textarea).
     - Reembolsar → diálogo premium com valor máximo validado.
   - Export CSV da lista filtrada.
   - Estados: skeleton (lista) + empty diferenciado (sem dados vs. filtros restritivos).

5. **CommissionsTable**
   - Padroniza no enum correto (`pago` ou `paga` conforme o schema) — checar `commissions.status` enum antes de gravar, fallback resistente.
   - Busca + filtro por parceiro/produto/status.
   - `confirmAction` ao marcar paga, com data e observação.
   - Invalida `fin-commissions`, `fin-payments`, `dashboard`.

6. **CashFlow & Reports**
   - Normalizar comparação de comissões pagas (`["pago","paga"].includes(...)`).
   - Período configurável (30 / 60 / 90 dias).
   - Tooltip claro, cores `indigo` (entrada), `rose` (saída), `emerald` (saldo) — sem cair em dark.
   - Reports: filtro de 3/6/12 meses + export CSV do resumo.

7. **ByClient**
   - Autocomplete (Combobox) em vez de Select simples.
   - Inclui tabela inline de pagamentos vencidos com ação de confirmar/cancelar.
   - Export CSV do extrato.

8. **Tema claro premium** — `bg-slate-50/60`, cards `bg-white border-slate-200/70 rounded-lg shadow-sm`, Inter + JetBrains Mono para valores e datas. Remover `bg-card`, `bg-muted/40`, dark/violet.

9. **Permissões** — `canManage` derivado do hook de role, escondendo ações sensíveis para não-admins.

### Arquivos
- `src/pages/FinanceCenter.tsx` (reescrita completa do componente e subcomponentes).

### Fora de escopo
- Edge function `process-alerts`, schema, RLS, `types.ts`.
- Página `Finance.tsx` (Faturamento) — separada.
- Dialogs externos de criação de pagamento/comissão (continua o fluxo atual).
