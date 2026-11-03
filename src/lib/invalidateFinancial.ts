import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidação central dos dados de dinheiro.
 *
 * Cada tela criou suas próprias chaves de cache para as mesmas tabelas
 * (sales-rich-v2, finance-sales, dash-payments, report-data-sales...). Ao salvar,
 * cada tela invalidava só uma parte, e as outras ficavam com o dado velho.
 * Esta função invalida, de uma vez, toda chave cujo nome indique vendas,
 * pagamentos, comissões, despesas, metas, financeiro, dashboard ou demandas.
 */
const FINANCIAL_KEY = /(sale|venda|payment|receipt|commission|split|fin-|finance|dash|goal|meta|expense|deduction|report|journey|client-products|client-sales|client-payments|product-|demand|cockpit|overpay|statement|disclosure|partner-|provider-|referrer-|indicator)/i;

export function isFinancialQueryKey(key: readonly unknown[]): boolean {
  const head = key?.[0];
  return typeof head === "string" && FINANCIAL_KEY.test(head);
}

export function invalidateFinancialData(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: (q) => isFinancialQueryKey(q.queryKey) });
}
