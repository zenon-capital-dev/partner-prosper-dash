import { describe, it, expect } from "vitest";
import { isFinancialQueryKey } from "@/lib/invalidateFinancial";

describe("invalidação central", () => {
  it("pega as chaves de dinheiro usadas pelas telas", () => {
    for (const k of ["sales-rich-v2", "finance-sales", "fin-payments", "dash-sales", "report-data-sales", "commission-splits-unified",
      "commissions-list", "dashboard-goals", "sales_goals_actual", "client-products", "client-payments", "journey-sales-agg",
      "partner-commissions", "provider-commissions", "referrer-commissions", "admin-dashboard-snapshot", "deduction-types"]) {
      expect(isFinancialQueryKey([k]), k).toBe(true);
    }
  });
  it("não mexe em chaves que não são de dinheiro", () => {
    for (const k of ["notifications", "chat", "theme", "user-profile", "leads-kanban"]) {
      expect(isFinancialQueryKey([k]), k).toBe(false);
    }
  });
});
