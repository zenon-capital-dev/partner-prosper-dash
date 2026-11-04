import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const settle = vi.fn();
vi.mock("@/lib/cashFlow", async (orig) => ({
  ...(await orig<typeof import("@/lib/cashFlow")>()),
  cashCanAccess: vi.fn(() => Promise.resolve(true)),
  cashSettle: (...a: unknown[]) => settle(...a),
  cashMonth: vi.fn(() => Promise.resolve({
    month: "2026-11", period: "atual", cutoff: "2026-11-30", include_overdue: false,
    opening_configured: true, opening_reference_date: "2026-10-31", opening: 10000, opening_projected: false,
    entradas_realizadas: 3000, saidas_realizadas: 2000, resultado_realizado: 1000, saldo_realizado: 11000,
    entradas_pendentes: 0, saidas_pendentes: 1000, saldo_projetado: 10000, atrasados_receber: 0, atrasados_pagar: 0,
    nao_confirmado: 0, vendido_mes: 12000, lancamentos_sinalizados: 0,
    lines: [{
      source_type: "expense", source_id: "e1", direction: "saida", description: "Aluguel", counterparty: "Fornecedor",
      origin_label: "Despesa", sale_id: null, client_id: null, due_date: "2026-11-20", amount: 1000, settled: 0, balance: 1000,
      is_estimate: false, in_projection: true, effective_in_month: 0, last_effective: null, situation: "pendente", from_previous_month: false,
    }],
  })),
}));

import { CashFlowTab } from "@/components/finance/CashFlowTab";

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><CashFlowTab /></MemoryRouter>
  </QueryClientProvider>,
);

describe("tela do fluxo de caixa", () => {
  beforeEach(() => settle.mockReset());

  it("mostra o resumo do mês e separa o vendido do caixa", async () => {
    mount();
    expect(await screen.findByText("Saldo realizado")).toBeInTheDocument();
    expect(screen.getByText(/11\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/12\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });

  it("usa Pagar na saída e reenvia com a mesma chave depois de uma falha, sem perder o digitado", async () => {
    settle.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce("ok");
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Pagar" }));
    const send = await screen.findByRole("button", { name: "Registrar pagamento" });
    fireEvent.click(send);
    await waitFor(() => expect(settle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar pagamento" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    await waitFor(() => expect(settle).toHaveBeenCalledTimes(2));
    expect(settle.mock.calls[0][0].key).toBe(settle.mock.calls[1][0].key);
    expect(settle.mock.calls[0][0].amount).toBe(1000);
  });
});