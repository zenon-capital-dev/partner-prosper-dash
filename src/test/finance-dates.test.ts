import { describe, it, expect } from "vitest";
import { formatBRDate, addMonthsYmd } from "@/lib/datetime";
import { fetchAllRows } from "@/lib/fetchAll";
import { paymentReceivedAmount } from "@/lib/financial";

describe("datas da central financeira", () => {
  it("vencimento sem hora mostra o próprio dia", () => {
    expect(formatBRDate("2026-11-10")).toBe("10/11/2026");
    expect(formatBRDate("2026-01-01")).toBe("01/01/2026");
  });

  it("data com hora continua no fuso de Brasília", () => {
    expect(formatBRDate("2026-11-10T02:00:00Z")).toBe("09/11/2026");
  });

  it("parcelas mensais respeitam o fim do mês", () => {
    expect(addMonthsYmd("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsYmd("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsYmd("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsYmd("2026-12-10", 1)).toBe("2027-01-10");
  });
});

describe("busca paginada", () => {
  it("junta todas as páginas", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => i);
    const rows = await fetchAllRows(async (from, to) => ({ data: all.slice(from, to + 1), error: null }));
    expect(rows.length).toBe(2500);
  });
  it("propaga erro", async () => {
    await expect(fetchAllRows(async () => ({ data: null, error: new Error("x") }))).rejects.toThrow("x");
  });
});

describe("recebido", () => {
  it("parcial conta só o valor pago", () => {
    expect(paymentReceivedAmount({ status: "parcialmente_pago", amount: 1000, amount_paid: 400 })).toBe(400);
  });
  it("pagamento com data futura ainda não entrou", () => {
    expect(paymentReceivedAmount({ status: "pago", amount: 1000, paid_at: "2999-01-01T12:00:00Z" })).toBe(0);
  });
});
