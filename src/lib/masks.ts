// Máscaras BR profissionais — formatação progressiva para inputs.

export const onlyDigits = (v: string | number | null | undefined): string =>
  String(v ?? "").replace(/\D+/g, "");

export const unmask = onlyDigits;

export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function maskCPFCNPJ(value: string): string {
  const d = onlyDigits(value);
  return d.length <= 11 ? maskCPF(d) : maskCNPJ(d);
}

export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// Aceita fixo (10) e celular (11). Formato: (DD) 9999-9999 ou (DD) 99999-9999.
export function maskPhoneBR(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCurrencyBR(value: string | number): string {
  const d = onlyDigits(String(value));
  if (!d) return "";
  const n = Number(d) / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type MaskKind = "cpf" | "cnpj" | "cpfcnpj" | "cep" | "phone" | "currency";

export function applyMask(kind: MaskKind, value: string): string {
  switch (kind) {
    case "cpf": return maskCPF(value);
    case "cnpj": return maskCNPJ(value);
    case "cpfcnpj": return maskCPFCNPJ(value);
    case "cep": return maskCEP(value);
    case "phone": return maskPhoneBR(value);
    case "currency": return maskCurrencyBR(value);
  }
}
