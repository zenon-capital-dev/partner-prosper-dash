import { maskCPFCNPJ, maskPhoneBR, maskCEP, onlyDigits } from "./masks";

/** Formata para exibir em listas/cards (dados salvos como dígitos puros) */
export const formatCPFCNPJ = (v?: string | null) => (v ? maskCPFCNPJ(v) : "—");
export const formatPhone = (v?: string | null) => (v ? maskPhoneBR(v) : "—");
export const formatCEP = (v?: string | null) => (v ? maskCEP(v) : "—");
export const formatDoc = formatCPFCNPJ;

export function formatCurrencyBRL(v?: number | string | null): string {
  if (v == null || v === "") return "R$ 0,00";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", timeZone: "America/Sao_Paulo" });
}
