/**
 * Metas: uma fórmula só, calculada no banco (sales_goal_actuals).
 * Metas e Dashboard leem daqui. Regras:
 *  - venda realizada conta no mês em que foi concluída (closed_at, ou sale_date);
 *  - receita = recebido do cliente, no mês de competência da parcela, só vendas concluídas.
 */
export interface GoalActuals {
  leads: number;
  proposals: number;
  sales_count: number;
  revenue: number;
  recurring_revenue: number;
  one_time_revenue: number;
  stage_movements: number;
  clients_closed: number;
  clientes_fechados: number;
  captacao_mes: number;
  captacao_semana: number;
  captacao_dia: number;
  stage_counts: Record<string, number>;
}

const KEY_BY_TYPE: Record<string, keyof GoalActuals> = {
  leads: "leads",
  proposals: "proposals",
  sales_count: "sales_count",
  revenue: "revenue",
  faturamento: "revenue",
  recorrencia_mensal: "recurring_revenue",
  receita_avulsa: "one_time_revenue",
  stage_movements: "stage_movements",
  atendimentos_realizados: "stage_movements",
  clients_closed: "clients_closed",
  clientes_fechados: "clientes_fechados",
  captacao_clientes_mes: "captacao_mes",
  captacao_clientes_semana: "captacao_semana",
  captacao_clientes_dia: "captacao_dia",
};

export const MONEY_GOAL_TYPES = new Set(["revenue", "faturamento", "recorrencia_mensal", "receita_avulsa"]);

/** Realizado de uma meta. Metas personalizadas usam o valor lançado à mão. */
export function goalActual(goal: { goal_type: string; actual_value?: number | null }, actuals: Partial<GoalActuals> | null | undefined): number {
  const t = String(goal.goal_type || "");
  if (t.startsWith("custom:")) return Number(goal.actual_value ?? 0);
  if (t.startsWith("stage:")) return Number(actuals?.stage_counts?.[t.slice("stage:".length)] ?? 0);
  const key = KEY_BY_TYPE[t];
  if (key && actuals && actuals[key] != null) return Number(actuals[key] as number);
  return Number(goal.actual_value ?? 0);
}
