# Fluxo de caixa

Sem dados de clientes: este repositório é público.

## Como funciona

| Conceito | Onde fica |
|---|---|
| A receber | `payments` (parcelas) e `cash_other_income` (entrada avulsa) |
| A pagar | `expenses` e `commission_splits` |
| Dinheiro que entrou ou saiu | `cash_settlements`: só acrescenta linhas; estorno é outra linha |
| Saldo real em uma data | `cash_opening_balances` |
| Quem vê o caixa | admin e super admin; outros só com linha em `cash_permissions` |
| Quem opera uma baixa | os acima e admin secundário |

Os campos antigos (`payments.amount_paid`, `expenses.paid`, status dos repasses) viram espelho do livro. Se uma tela gravar direto neles, um gatilho registra a diferença no livro.

Funções: `cash_settle`, `cash_receive_for_sale`, `cash_reverse`, `cash_reverse_source`, `cash_refund_payment`, `cash_confirm_historic`, `cash_create_entry`, `cash_cancel_income`, `cash_convert_monthly_sale`, `cash_set_opening_balance`, `cash_month`, `cash_can_access`.

## Regras de cálculo

| Indicador | Regra |
|---|---|
| Entradas e saídas realizadas | Liquidações menos estornos, pela data efetiva, dentro do mês |
| Saldo inicial | Saldo informado + movimentos depois dele − movimentos entre o início do mês e ele |
| Saldo realizado | Saldo inicial + entradas − saídas, até a data de corte (hoje, no mês atual) |
| Pendentes do mês | Saldo aberto com vencimento no mês |
| Saldo projetado | Saldo realizado + entradas pendentes − saídas pendentes. Atrasados de meses anteriores só entram com a chave ligada |
| Mês passado | Fechamento realizado |
| Mês futuro | Saldo inicial projetado a partir do saldo de hoje |
| Atrasados | Saldo aberto com vencimento antes de hoje |
| Vendido no mês | Vendas concluídas pela `sale_date`. Não é caixa |
| Sem saldo informado | Saldo fica "não configurado", nunca zero |
| Comissão a pagar | Valor liberado menos pago. Vence na data do último recebimento da venda |
| Venda em negociação | Não entra na previsão |
| Provisão automática | Aparece como estimativa e só aceita pagamento integral |

Comportamentos bloqueados, com mensagem: pagamento acima do saldo, data efetiva futura, mais de 2 casas decimais, valor abaixo do já pago, cancelar ou excluir com pagamento lançado, alterar o livro.

## Recorrência

`sales.amount` é sempre o valor total do contrato, e a comissão incide sobre ele. Venda antiga gravada com o valor mensal é convertida por `cash_convert_monthly_sale`, depois de confirmada: multiplica valor e custos pelos meses, não muda parcelas, recalcula a comissão preservando o que já foi pago, e registra o valor anterior em `cash_sale_adjustments`.

### Comissão

A comissão total incide sobre o líquido do contrato. Ela é liberada na proporção do que entra, o que equivale ao líquido de cada parcela: em uma parcela de R$ 4.000 de um contrato de R$ 12.000 com R$ 3.000 de custos, o líquido é R$ 3.000; com 10%, libera R$ 300.

### Contrato com valor estimado

Quando os recebimentos variam, a venda não precisa de parcelas fixas. "Registrar Recebimento" abate as parcelas abertas e, se passar delas, cria uma parcela com o valor e a data do recebimento, até o saldo do contrato. Acima disso, o sistema recusa e pede para ajustar o valor da venda. O saldo sem data aparece no fluxo de caixa e fica fora da projeção.

## Ordem de implantação

1. Backup do banco.
2. Aplicar `20261103200000` a `20261103260000`.
3. Aplicar `20261104120000_fluxo_de_caixa.sql`.
4. Publicar o frontend. **Não publique antes:** "Registrar Recebimento" chama uma função que só existe depois do passo 3.
5. Informar o saldo inicial em Central Financeira, Fluxo de caixa.

Entre os passos 3 e 4, as telas antigas continuam funcionando, e o gatilho registra as baixas no livro.

## Matriz de requisitos

| Requisito da especificação | Implementação | Teste | Estado |
|---|---|---|---|
| Mês, saldos, previsto e realizado | `cash_month`, `CashFlowTab` | `cash-ledger-db`, `cash-flow-tab` | Verificado com dados de teste; tela publicada não verificada |
| Recebimento e pagamento, integral ou parcial | `cash_settle` | `cash-ledger-db` | Verificado no banco de teste |
| Entrada e saída avulsas | `cash_create_entry` | `cash-ledger-db` | Verificado; comprovante não incluído |
| Origem e histórico | `HistoryDialog`, `cash_settlements` | `cash-ledger-db` | Banco verificado; diálogo não exercitado |
| Correção auditável | `cash_reverse`, `cash_refund_payment` | `cash-ledger-db` | Verificado no banco de teste |
| Exportação | `cashCsv` | Nenhum | Implementado, não verificado |
| Mesma ação em qualquer tela | Gatilhos de captura e `cash_receive_for_sale` | `cash-ledger-db` | Banco verificado; telas não abertas |
| Sem linha nova ao receber | `ReceivePaymentDialog` | `cash-ledger-db` | Banco verificado |
| Comissão não vira paga sozinha | `recompute_sale_release` | `cash-ledger-db` | Verificado no banco de teste |
| Repetição não duplica | Chave de idempotência e trava de linha | `cash-ledger-db`, `cash-flow-tab` | Repetição verificada; duas sessões não verificadas |
| Permissão no backend | `can_access_cash`, `can_operate_cash`, RLS | `cash-ledger-db` | Verificado; tela para conceder permissão não existe |
| Saldo inicial sem duplicar | `cash_month` | `cash-ledger-db` | Verificado no banco de teste |
| Datas e fuso | `cash_today`, datas de calendário | `cash-ledger-db` | Verificado no banco de teste |
| Parcelas dentro da venda | `SaleParcelsPanel` | Nenhum | Implementado, não verificado |
| Histórico sem inventar dados | Registro no livro, sinalizado | `cash-ledger-db` | Verificado em dados de teste; não rodou nos dados reais |
| Contas e transferências | Uma conta | n/a | Não aplicável: o sistema não tem contas bancárias |
| Moedas | Só real | n/a | Não aplicável |
| Renegociação | Não implementada | Nenhum | Pendente de decisão |
| Recorrência: `sales.amount` é sempre o total do contrato; comissão sobre o contrato inteiro | Campo Mensalidade no formulário; `cash_convert_monthly_sale` para venda antiga | `cash-ledger-db` | Conversão verificada no banco de teste; vendas reais dependem de confirmação uma a uma |
| Caixinha | Fora do saldo | Nenhum | Pendente de decisão |
| Comprovante e anexos | Não incluídos | Nenhum | Pendente |
| Concorrência entre sessões | Trava de linha | Nenhum | Implementado, não verificado: o PGlite tem uma conexão |

## Consumidores

| Consumidor | Local | Dados | Efeito | Alterado? |
|---|---|---|---|---|
| Fluxo de caixa | `CashFlowTab.tsx`, `cashFlow.ts` | `cash_month` | Tela nova; substitui o gráfico antigo | Sim |
| Registrar recebimento | `ReceivePaymentDialog.tsx` | `payments` | Abate a parcela; excluir vira estorno | Sim |
| Formulário de venda | `SaleFormDialog.tsx`, `SaleParcelsPanel.tsx` | `payments` | Mostra as parcelas | Sim |
| Cancelar venda | `Sales.tsx` | `payments` | Não cancela parcela com valor recebido | Sim |
| Reembolso | `FinanceCenter.tsx` | `payments` | Vira devolução no livro | Sim |
| Baixa na Central e na ficha | `FinanceCenter.tsx`, `ClientFinancial.tsx`, `ClientFichaTabs.tsx` | `payments` | Mesma gravação; o gatilho registra no livro | Não |
| Lançar pagamento na ficha | `ClientFichaTabs.tsx`, `PaymentFormDialog.tsx` | `payments` | Pode criar linha fora do cronograma. **Falta avisar sobre parcela em aberto** | Não, pendente |
| Despesas | `ExpensesTab.tsx`, `Finance.tsx` | `expenses` | O gatilho registra | Não |
| Comissões | `Commissions.tsx`, `PartnerDetail.tsx`, `PartnerDetailDrawer.tsx` | `commissions`, `commission_splits` | O gatilho registra e espelha | Não |
| Vendas, Central e Dashboard | `Sales.tsx`, `FinanceCenter.tsx`, `DashboardAdmin.tsx`, `useDashboardStats.ts` | `amount_paid`, `status` | Continuam corretos porque os campos espelham o livro | Não |
| Ficha, lista e jornada | `ClientDetail.tsx`, `Clients.tsx`, `ClientJourney.tsx`, `ClientOnboarding.tsx`, `IntelligentSummary.tsx`, `ClientTimelineTab.tsx` | `payments` | Idem | Não |
| Painel do cliente | `ClientPanel.tsx`, `client_submit_payment_receipt` | `payments` | Idem; o comprovante do cliente não dá baixa | Não |
| Relatórios e outros | `Reports.tsx`, `OperationalCockpit.tsx`, `Tasks.tsx`, `lib/demand.ts`, `RevenueMap.tsx` | `payments` | Idem. `RevenueMap` tem lista própria de status | Não |
| Painéis externos | `my_commission_statement`, `my_sale_disclosure` | Repasses | Pagamento parcial de repasse não aparece como pago | Não, limitação |
| Metas | `goal_actuals`, `trg_goals_on_payment` | `payments` | Recalcula pelos campos espelhados | Não |
| Relatório de consistência | `financial_consistency_report` | `payments` | Soma parcela parcial pelo valor cheio. **Precisa de ajuste** | Não, pendente |
| Excluir cliente ou produto | `admin_delete_client_cascade`, `admin_delete_product_cascade` | `payments` | Passa a recusar quando há pagamento lançado | Não |
| Caixinha | `trg_credit_project_pool` | `paid_at` | Estorno não devolve o crédito | Não, limitação |
| Snapshot do Dashboard | `admin_dashboard_snapshot` | `payments` | Lê os campos espelhados; não exercitado | Não |
| Alertas | `process-alerts` | `commissions` | Não grava pagamento | Não |

## Como testar

```bash
npm install --no-save --legacy-peer-deps --ignore-scripts @electric-sql/pglite@0.2.17 @testing-library/dom
```

```bash
npx vitest run
```

`cash-ledger-db.test.ts` aplica todas as migrations no PGlite. Sem o pacote, esse teste é ignorado.
