# Alinhamento financeiro — entrega para revisão

Base: `main` em `4bc605b0` (inclui os merges dos PRs #11 e #12).

## Comportamento

- Venda concluída conta em `sale_date`. `closed_at` continua sendo histórico de conclusão.
- Recebido mensal usa `paid_at` em `America/Sao_Paulo`, sem fallback para vencimento ou competência.
- `private.recompute_sale_release` atualiza valor liberado e status `liberada`, nunca marca repasse como pago nem preenche sua data. Repasse manual já pago é preservado inclusive após estorno do cliente.
- Na tabela legada `commissions`, o estado de liberação fica em `workflow_status`; `status` não vira pago automaticamente. A cobrança avulsa também deixa de criar repasse automaticamente pago.
- `financeEngine.expectedCommission` usa o líquido para parceiro, indicador e colaborador. Contratos explicitamente `legado` mantêm a regra anterior até a conversão já prevista nos PRs anteriores.
- Voltar a `pendente` ou `em_andamento` com valor pago é bloqueado no banco, inclusive pelo caminho intermediário `cancelada`. Registrar recebimento em venda projetada também é bloqueado.
- Adiar um repasse na Central preserva sua liberação e não desfaz um pagamento existente.

## Adiantamento: representação adotada

O banco **redistribui o cronograma**, mantendo o recebimento inteiro na parcela em que foi registrado. Assim, não inventa entrada na data de vencimento nem sobrescreve a data de uma parcela parcialmente paga.

| Campo | Antes | Depois de receber R$ 1.500 na primeira parcela |
|---|---|---|
| `sales.amount` | 2.000 | 2.000 |
| Primeira parcela: `amount / amount_paid` | 1.000 / 0 | 1.500 / 1.500 |
| Próxima parcela: `amount / amount_paid` | 1.000 / 0 | 500 / 0 |
| Total recebido | 0 | 1.500 |
| Saldo a receber | 2.000 | 500 |

O campo `scheduled_amount_before_advance` conserva o valor original de cada parcela afetada. A ordem é vencimento e UUID como desempate; só parcelas seguintes da mesma venda, abertas e com saldo, recebem abatimento. Nenhuma parcela é criada pelo frontend. Se sobrar após cobrir todo o contrato, o excedente permanece em `amount_paid` como crédito, sem aumentar o contrato. Salvar o mesmo recebimento novamente não repete o abatimento.

Uma redução/estorno posterior mantém o cronograma ajustado: o saldo reabre na entrada reduzida, sem reescrever recebimentos históricos. Pagamento agendado no futuro não distribui crédito antecipadamente; a confirmação efetiva deve gravar o recebimento na data em que ocorreu. O helper `allocatePayment` é um plano de cobertura; não deve ser usado para atualizar `amount_paid` de todas as parcelas no navegador.

## Preservações

Não altera políticas RLS existentes, `my_commission_statement`, `financial_visibility`, `sale_visibility_overrides`, `client_product_financials`, a cascata de deduções ou `generate_sale_payments`. Não abre consultas diretas para parceiro, indicador ou prestador.

## Aplicação

1. Aplicar `20261103270000_release_status.sql` e concluir sua transação.
2. Aplicar `20261103280000_financial_rules.sql` em outra transação. PostgreSQL exige commit do novo valor do enum antes de seu uso.
3. Publicar o frontend da mesma branch após as migrations.
4. Conferir em homologação uma venda de mês anterior, recebimento no mês seguinte, comissão liberada, repasse manual, adiantamento e tentativa de reprojeção.

Nenhuma migration foi aplicada à produção nesta entrega. Os testes SQL executam PostgreSQL via PGlite com uma fixture mínima das tabelas utilizadas; não equivalem à execução de todo o histórico de migrations e RLS em uma instância Supabase. Locks entre sessões precisam de homologação com PostgreSQL servidor.

## Histórico e limites

Registros antigos já marcados `pago` não são convertidos automaticamente: o banco anterior preenchia esse estado e data tanto para liberação automática quanto para repasse real. Reclassificá-los exige evidência de pagamento, para não desfazer repasses legítimos. Recebimentos históricos sem `paid_at` não são atribuídos artificialmente a um mês.

O modelo existente de `payments` guarda valor pago acumulado e uma data por parcela. Este trabalho não cria um livro de lançamentos para separar várias entradas em datas diferentes dentro da mesma parcela.

## Validação reproduzível

```sh
npm ci --legacy-peer-deps
npm test
npm run build
npx tsc --noEmit -p tsconfig.app.json
```

O lockfile anterior estava divergente do `package.json` e impedia `npm ci`. Foi sincronizado; as duas dependências adicionadas ao manifesto são de teste (`@electric-sql/pglite` e o peer ausente `@testing-library/dom`). O uso de `--legacy-peer-deps` mantém a compatibilidade com o conflito de peers já existente entre `react-day-picker` e `date-fns`.
