import { describe, it, expect } from "vitest";
import { effectiveVisibility, isInheritAll, INHERIT_ALL, NO_VISIBILITY } from "@/lib/visibility";

describe("visibilidade financeira", () => {
  it("padrão é tudo bloqueado", () => {
    expect(effectiveVisibility(null, null)).toEqual(NO_VISIBILITY);
  });
  it("cadastro libera e a venda pode bloquear ou liberar item a item", () => {
    const cadastro = { see_gross: true, see_payments: false, see_deductions: false };
    expect(effectiveVisibility(cadastro, INHERIT_ALL)).toEqual(cadastro);
    expect(effectiveVisibility(cadastro, { see_gross: false, see_payments: null, see_deductions: true }))
      .toEqual({ see_gross: false, see_payments: false, see_deductions: true });
  });
  it("ajuste vazio volta ao padrão do cadastro", () => {
    expect(isInheritAll(INHERIT_ALL)).toBe(true);
    expect(isInheritAll({ see_gross: false, see_payments: null, see_deductions: null })).toBe(false);
  });
});
