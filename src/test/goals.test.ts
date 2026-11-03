import { describe, it, expect } from "vitest";
import { goalActual } from "@/lib/goals";

const actuals = {
  leads: 4, proposals: 2, sales_count: 3, revenue: 30000, recurring_revenue: 5000, one_time_revenue: 25000,
  stage_movements: 7, clients_closed: 1, clientes_fechados: 2, captacao_mes: 5, captacao_semana: 2, captacao_dia: 1,
  stage_counts: { "abc": 9 },
};

describe("metas com fórmula única", () => {
  it("tipos da tela de Metas e do Dashboard leem o mesmo número", () => {
    expect(goalActual({ goal_type: "revenue" }, actuals)).toBe(30000);
    expect(goalActual({ goal_type: "faturamento" }, actuals)).toBe(30000);
    expect(goalActual({ goal_type: "recorrencia_mensal" }, actuals)).toBe(5000);
    expect(goalActual({ goal_type: "receita_avulsa" }, actuals)).toBe(25000);
    expect(goalActual({ goal_type: "atendimentos_realizados" }, actuals)).toBe(7);
  });
  it("estágio usa a contagem atual e personalizada usa o valor lançado", () => {
    expect(goalActual({ goal_type: "stage:abc" }, actuals)).toBe(9);
    expect(goalActual({ goal_type: "custom:num:Visitas", actual_value: 12 }, actuals)).toBe(12);
  });
  it("sem dados do banco cai no valor gravado", () => {
    expect(goalActual({ goal_type: "revenue", actual_value: 10 }, null)).toBe(10);
  });
});
