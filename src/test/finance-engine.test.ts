import { describe, it, expect } from "vitest";
import {
  realizedKpis, projectedKpis, allKpis, monthResult, saleKind, paymentReceived, paymentOutstanding,
  commissionTotals, canRevertToProjected, allocatePayment, saleAmountInPeriod, ymdInBrazil,
  type FinanceData, type FPayment, type Period,
} from "@/lib/financeEngine";

/**
 * Carteira de referência (prompt mestre, seção 10). Hoje = 03/11/2026 (Brasília).
 * Todos os valores esperados foram calculados à mão.
 *  A  concluída 05/10, R$ 70.000, custos 21.000, parceiro 10%; p1 35.000 paga 10/10; p2 35.000 vence 10/11
 *     comissões automáticas por pagamento: 3.500 (p1, marcada "pago" pelo banco) e 3.500 (p2)
 *  B  pendente 15/12, R$ 120.000, custos 36.000, parceiro 10% (prevista 12.000)
 *  C  cancelada 20/10, R$ 30.000, parcela cancelada sem pagamento
 *  D  concluída recorrente 01/09, 3 × 5.000; set paga e reembolsada em 1.000; out paga; nov vence 01/11 aberta
 *  E  cobrança avulsa R$ 2.000 vence 30/10, aberta
 *  G  cancelada 25/10, R$ 8.000; parcela cancelada com R$ 3.000 já pagos em 26/10
 *  R  pendente recorrente, R$ 12.000 em 3 meses a partir de 10/01/2027
 */
const TODAY = "2026-11-03";
const ALL: Period = { kind: "all" };
const M = (ym: string): Period => ({ kind: "month", ym });

const data: FinanceData = {
  taxRatePercent: 0,
  sales: [
    { id: "A", status: "concluida", amount: 70000, sale_date: "2026-10-05", zenon_cost: 7000, provider_cost: 14000, partner_id: "pa1", commission_percent: 10 },
    { id: "B", status: "pendente", amount: 120000, sale_date: "2026-12-15", zenon_cost: 12000, provider_cost: 24000, partner_id: "pa1", commission_percent: 10 },
    { id: "C", status: "cancelada", amount: 30000, sale_date: "2026-10-20" },
    { id: "D", status: "concluida", amount: 15000, sale_date: "2026-09-01", revenue_type: "recorrente", recurrence_months: 3 },
    { id: "G", status: "cancelada", amount: 8000, sale_date: "2026-10-25" },
    { id: "R", status: "pendente", amount: 12000, sale_date: "2026-11-20", revenue_type: "recorrente", recurrence_months: 3, recurrence_start: "2027-01-10" },
  ],
  payments: [
    { id: "A1", sale_id: "A", amount: 35000, amount_paid: 35000, status: "pago", due_date: "2026-10-10", paid_at: "2026-10-10T15:00:00Z" },
    { id: "A2", sale_id: "A", amount: 35000, amount_paid: 0, status: "pendente", due_date: "2026-11-10", paid_at: null },
    { id: "C1", sale_id: "C", amount: 30000, amount_paid: 0, status: "cancelado", due_date: "2026-11-20", paid_at: null },
    { id: "D1", sale_id: "D", amount: 5000, amount_paid: 5000, status: "reembolsado", refund_amount: 1000, due_date: "2026-09-01", paid_at: "2026-09-01T15:00:00Z" },
    { id: "D2", sale_id: "D", amount: 5000, amount_paid: 5000, status: "pago", due_date: "2026-10-01", paid_at: "2026-10-01T15:00:00Z" },
    { id: "D3", sale_id: "D", amount: 5000, amount_paid: 0, status: "pendente", due_date: "2026-11-01", paid_at: null },
    { id: "E1", sale_id: null, amount: 2000, amount_paid: 0, status: "pendente", due_date: "2026-10-30", paid_at: null },
    { id: "G1", sale_id: "G", amount: 8000, amount_paid: 3000, status: "cancelado", due_date: "2026-10-25", paid_at: "2026-10-26T15:00:00Z" },
  ],
  splits: [
    { id: "k1", sale_id: null, payment_id: "A1", amount: 3500, status: "pago", beneficiary_type: "partner", beneficiary_id: "pa1" },
    { id: "k2", sale_id: null, payment_id: "A2", amount: 3500, status: "pendente", beneficiary_type: "partner", beneficiary_id: "pa1" },
  ],
  expenses: [{ amount: 1000, expense_date: "2026-10-05" }],
  reserves: [{ amount: 2000, reference_month: "2026-10-01" }],
};

describe("classificação (Q1/Q2)", () => {
  it("concluída = realizada; pendente e em andamento = projetada; cancelada", () => {
    expect(saleKind({ status: "concluida" })).toBe("realizada");
    expect(saleKind({ status: "pendente" })).toBe("projetada");
    expect(saleKind({ status: "em_andamento" })).toBe("projetada");
    expect(saleKind({ status: "cancelada" })).toBe("cancelada");
  });
});

describe("Realizadas · Todos os meses", () => {
  const k = realizedKpis(data, ALL, TODAY);
  it("vendido = A + D (cancelada e projetadas fora)", () => expect(k.sold).toBe(85000));
  it("recebido = 35.000 + 4.000 + 5.000 + 3.000 (pago de venda cancelada fica — Q10)", () => expect(k.received).toBe(47000));
  it("a receber = 35.000 + 5.000 + 2.000 avulsa (saldo de cancelada não conta)", () => expect(k.outstanding).toBe(42000));
  it("vencido = D nov + avulsa", () => expect(k.overdue).toBe(7000));
  it("outras receitas (avulsa) ainda sem recebimento", () => expect(k.otherIncome).toBe(0));
  it("custos proporcionais ao recebido: 21.000 × 35/70", () => expect(k.costs).toBe(10500));
  it("comissão liberada 3.500; nada repassado; a pagar 3.500 (Q5/Q6)", () => expect(k.commissions).toEqual({ released: 3500, paid: 0, toPay: 3500 }));
  it("líquido = 47.000 − 10.500 − 3.500 − 0", () => expect(k.net).toBe(33000));
});

describe("Realizadas · por mês (Q3 venda pela data; Q4 recebido pelo caixa)", () => {
  it("setembro: vendido 15.000 (D), recebido 4.000 (5.000 − reembolso 1.000)", () => {
    const k = realizedKpis(data, M("2026-09"), TODAY);
    expect([k.sold, k.received]).toEqual([15000, 4000]);
  });
  it("outubro: vendido 70.000; recebido 43.000; a receber com vencimento no mês 2.000 (vencido)", () => {
    const k = realizedKpis(data, M("2026-10"), TODAY);
    expect([k.sold, k.received, k.outstanding, k.overdue]).toEqual([70000, 43000, 2000, 2000]);
    expect(k.commissions.released).toBe(3500);
    expect(k.net).toBe(29000);
  });
  it("novembro: nada vendido nem recebido; a receber 40.000, vencido 5.000", () => {
    const k = realizedKpis(data, M("2026-11"), TODAY);
    expect([k.sold, k.received, k.outstanding, k.overdue]).toEqual([0, 0, 40000, 5000]);
  });
});

describe("Projetadas (sem fluxo de pagamento)", () => {
  it("todos os meses: B + R", () => {
    expect(projectedKpis(data, ALL)).toEqual({ value: 132000, count: 2, expectedCommission: 12000, expectedCosts: 36000, expectedNet: 84000 });
  });
  it("dezembro: só B", () => expect(projectedKpis(data, M("2026-12")).value).toBe(120000));
  it("recorrente projetada distribuída nos meses do contrato (Q7)", () => {
    expect([M("2027-01"), M("2027-02"), M("2027-03"), M("2027-04")].map((p) => projectedKpis(data, p).value)).toEqual([4000, 4000, 4000, 0]);
  });
  it("novembro: nada projetado (R só começa em janeiro)", () => expect(projectedKpis(data, M("2026-11")).value).toBe(0));
  it("projetada nunca gera recebido nem a receber", () => {
    const only: FinanceData = { sales: [data.sales[1]], payments: [{ id: "x", sale_id: "B", amount: 1000, amount_paid: 1000, status: "pago", due_date: "2026-10-01", paid_at: "2026-10-01T12:00:00Z" }], splits: [] };
    const k = realizedKpis(only, ALL, TODAY);
    expect([k.received, k.outstanding, k.commissions.released]).toEqual([0, 0, 0]);
  });
});

describe("Todas", () => {
  it("realizado e projetado separados; total esperado", () => {
    const k = allKpis(data, ALL, TODAY);
    expect([k.realized, k.projected, k.expectedTotal]).toEqual([85000, 132000, 217000]);
  });
});

describe("Resultado do mês (Q8: despesas e caixinhas separadas)", () => {
  it("outubro: 29.000 − 1.000 − 2.000", () => expect(monthResult(data, M("2026-10"), TODAY)).toEqual({ net: 29000, expenses: 1000, reserves: 2000, result: 26000 }));
});

describe("pagamentos — casos-limite", () => {
  const p = (o: Partial<FPayment>): FPayment => ({ id: "p", sale_id: "A", amount: 1000, amount_paid: 0, status: "pendente", due_date: "2026-11-01", paid_at: null, ...o });
  it("pagamento com data futura ainda não entrou", () => expect(paymentReceived(p({ status: "pago", amount_paid: 1000, paid_at: "2026-12-01T12:00:00Z" }), TODAY)).toBe(0));
  it("pagamento às 23h de 03/11 em Brasília (02h UTC de 04/11) conta como hoje", () => expect(paymentReceived(p({ status: "pago", amount_paid: 1000, paid_at: "2026-11-04T02:00:00Z" }), TODAY)).toBe(1000));
  it("parcial: recebido 400 e saldo 600", () => {
    const x = p({ status: "parcialmente_pago", amount_paid: 400, paid_at: "2026-10-01T12:00:00Z" });
    expect([paymentReceived(x, TODAY), paymentOutstanding(x)]).toEqual([400, 600]);
  });
  it("reembolso total sem valor informado zera; parcial desconta só o reembolso", () => {
    expect(paymentReceived(p({ status: "reembolsado", amount_paid: 1000, paid_at: "2026-10-01T12:00:00Z" }), TODAY)).toBe(0);
    expect(paymentReceived(p({ status: "reembolsado", amount_paid: 1000, refund_amount: 300, paid_at: "2026-10-01T12:00:00Z" }), TODAY)).toBe(700);
  });
  it("estornado não conta e não tem saldo", () => {
    const x = p({ status: "estornado", amount_paid: 1000, paid_at: "2026-10-01T12:00:00Z" });
    expect([paymentReceived(x, TODAY), paymentOutstanding(x)]).toEqual([0, 0]);
  });
  it("'pago' sem amount_paid usa o valor da parcela", () => expect(paymentReceived(p({ status: "pago", paid_at: "2026-10-01T12:00:00Z" }), TODAY)).toBe(1000));
  it("venda cancelada com parcela ainda 'pendente' não entra no a receber", () => {
    const d: FinanceData = { sales: [{ id: "C", status: "cancelada", amount: 30000, sale_date: "2026-10-20" }], payments: [p({ sale_id: "C", amount: 30000 })], splits: [] };
    expect(realizedKpis(d, ALL, TODAY).outstanding).toBe(0);
  });
  it("parcela de venda inexistente é ignorada", () => {
    expect(realizedKpis({ sales: [], payments: [p({ sale_id: "nao-existe" })], splits: [] }, ALL, TODAY).outstanding).toBe(0);
  });
  it("valores nulos não quebram", () => expect(paymentOutstanding(p({ amount: null, amount_paid: null }))).toBe(0));
  it("data sem hora fica no próprio dia", () => expect(ymdInBrazil("2026-11-10")).toBe("2026-11-10"));
});

describe("comissões — sem contar em dobro", () => {
  it("comissão lançada na venda + automática por pagamento do mesmo parceiro: vale só a da venda", () => {
    const d: FinanceData = { ...data, splits: [...data.splits, { id: "m1", sale_id: "A", payment_id: null, amount: 7000, status: "pendente", beneficiary_type: "partner", beneficiary_id: "pa1" }] };
    expect(commissionTotals(d, ALL, TODAY, () => true).released).toBe(3500); // 7.000 × 35/70, sem somar k1
  });
  it("comissão manual marcada como paga conta como repassada", () => {
    const d: FinanceData = { ...data, splits: [{ id: "m1", sale_id: "A", payment_id: null, amount: 7000, status: "pago", beneficiary_type: "partner", beneficiary_id: "pa1", paid_out_at: "2026-10-15T12:00:00Z" }] };
    expect(commissionTotals(d, ALL, TODAY, () => true)).toEqual({ released: 3500, paid: 7000, toPay: 0 });
  });
  it("comissão cancelada não conta", () => {
    const d: FinanceData = { ...data, splits: data.splits.map((s) => ({ ...s, status: "cancelado" })) };
    expect(commissionTotals(d, ALL, TODAY, () => true).released).toBe(0);
  });
  it("comissão de venda projetada não aparece", () => {
    const d: FinanceData = { ...data, splits: [{ id: "m2", sale_id: "B", payment_id: null, amount: 12000, status: "pendente", beneficiary_type: "partner", beneficiary_id: "pa1" }] };
    expect(commissionTotals(d, ALL, TODAY, () => true).released).toBe(0);
  });
});

describe("regras de gravação", () => {
  it("não deixa voltar para projetada com valor pago; deixa sem pagamento", () => {
    expect(canRevertToProjected("A", data.payments, TODAY)).toBe(false);
    expect(canRevertToProjected("B", data.payments, TODAY)).toBe(true);
  });
  it("pagou a mais: excedente abate a próxima parcela", () => {
    const pays: FPayment[] = [
      { id: "x1", sale_id: "S", amount: 1000, amount_paid: 0, status: "pendente", due_date: "2026-11-01", paid_at: null },
      { id: "x2", sale_id: "S", amount: 1000, amount_paid: 0, status: "pendente", due_date: "2026-12-01", paid_at: null },
    ];
    expect(allocatePayment(pays[0], 1500, pays)).toEqual([{ id: "x1", add: 1000 }, { id: "x2", add: 500 }]);
    expect(allocatePayment(pays[0], 2500, pays)).toEqual([{ id: "x1", add: 1000 }, { id: "x2", add: 1000 }, { id: "x1", add: 500 }]);
  });
  it("arredondamento: recorrente projetada soma exatamente o total", () => {
    const s = { id: "z", status: "pendente", amount: 1000, sale_date: "2026-01-01", revenue_type: "recorrente", recurrence_months: 3 };
    const months = ["2026-01", "2026-02", "2026-03"].map((ym) => saleAmountInPeriod(s, M(ym)));
    expect(months).toEqual([333.33, 333.33, 333.34]);
    expect(months.reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 2);
  });
});

describe("volume", () => {
  it("2.500 parcelas somam completas (sem corte de 300/1000)", () => {
    const pays: FPayment[] = Array.from({ length: 2500 }, (_, i) => ({ id: `q${i}`, sale_id: "A", amount: 10, amount_paid: 10, status: "pago", due_date: "2026-10-01", paid_at: "2026-10-01T12:00:00Z" }));
    expect(realizedKpis({ sales: [data.sales[0]], payments: pays, splits: [] }, ALL, TODAY).received).toBe(25000);
  });
});
