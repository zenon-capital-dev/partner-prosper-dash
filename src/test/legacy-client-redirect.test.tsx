import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LegacyClientRedirect } from "@/components/LegacyClientRedirect";

afterEach(cleanup);

function Destination() {
  const { pathname, search, hash } = useLocation();
  return <output>{pathname + search + hash}</output>;
}

describe("legacy client links", () => {
  it.each([
    ["/cliente", "/portal-cliente"],
    ["/cliente/documentos", "/portal-cliente/documentos"],
    ["/cliente/contratos", "/portal-cliente/contratos"],
    ["/cliente/suporte", "/portal-cliente/suporte"],
    ["/cliente/financeiro", "/portal-cliente/pagamentos"],
    ["/cliente/docs", "/portal-cliente/documentos"],
    ["/cliente/documentos?documento=123#pendentes", "/portal-cliente/documentos?documento=123#pendentes"],
    ["/cliente/onboarding", "/cliente/onboarding"],
  ])("routes %s to %s", (from, expected) => {
    render(
      <MemoryRouter initialEntries={[from]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/cliente" element={<LegacyClientRedirect />} />
          <Route path="/cliente/:tab" element={<LegacyClientRedirect />} />
          <Route path="/cliente/onboarding" element={<Destination />} />
          <Route path="/portal-cliente/*" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(expected);
  });
});
