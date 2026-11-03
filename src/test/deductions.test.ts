import { describe, it, expect } from "vitest";
import { deductionTotals, partnerBase, deductionAmount, rowFromDb, rowToDb, sameRows, type DeductionType, type DeductionRow } from "@/lib/deductions";

const types: DeductionType[] = [
  { id: "imp", name: "Imposto", category: "imposto", default_percent: 15, default_fixed_amount: null, sort_order: 10, active: true },
  { id: "jur", name: "Jurídico", category: "juridico", default_percent: 2, default_fixed_amount: null, sort_order: 20, active: true },
  { id: "sis", name: "Sistema", category: "sistema", default_percent: 3, default_fixed_amount: null, sort_order: 30, active: true },
  { id: "pre", name: "Prestador de serviço", category: "prestador", default_percent: 5, default_fixed_amount: null, sort_order: 40, active: true },
  { id: "pj1", name: "PJ 1", category: "pj", default_percent: 15, default_fixed_amount: null, sort_order: 50, active: true },
];
const pct = (id: string, p: number): DeductionRow => ({ deduction_type_id: id, mode: "percent", percent: p, fixed_amount: null });

describe("cascata de deduções", () => {
  it("exemplo do milhão: base 600 mil, parceiro 10% = 60 mil, prestador 50 mil", () => {
    const rows = [pct("imp", 15), pct("jur", 2), pct("sis", 3), pct("pre", 5), pct("pj1", 15)];
    const t = deductionTotals(rows, types, 1_000_000);
    expect(t.providerCost).toBe(50_000);
    expect(t.zenonCost).toBe(350_000);
    expect(t.total).toBe(400_000);
    const base = partnerBase(1_000_000, t.zenonCost, t.providerCost, "cascata");
    expect(base).toBe(600_000);
    expect((base * 10) / 100).toBe(60_000);
  });

  it("modelo legado não desconta o prestador da base (regra das vendas antigas)", () => {
    expect(partnerBase(1_000_000, 400_000, 50_000, "legado")).toBe(600_000);
    expect(partnerBase(1_000_000, 400_000, 50_000, "cascata")).toBe(550_000);
  });

  it("base nunca fica negativa e valor fixo é respeitado", () => {
    expect(partnerBase(100, 300, 0, "cascata")).toBe(0);
    expect(deductionAmount({ deduction_type_id: "x", mode: "fixed", percent: 99, fixed_amount: 1234.5 }, 1_000_000)).toBe(1234.5);
  });

  it("ida e volta com o banco grava só um dos campos", () => {
    const r = rowFromDb({ deduction_type_id: "imp", percent: 15, fixed_amount: null });
    expect(r.mode).toBe("percent");
    expect(rowToDb(r)).toEqual({ deduction_type_id: "imp", percent: 15, fixed_amount: null });
    const f = rowFromDb({ deduction_type_id: "pre", percent: null, fixed_amount: 50000 });
    expect(rowToDb(f)).toEqual({ deduction_type_id: "pre", percent: null, fixed_amount: 50000 });
    expect(sameRows([r, f], [f, r])).toBe(true);
  });
});
