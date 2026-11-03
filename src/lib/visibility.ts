/**
 * Visibilidade financeira de parceiro, indicador e prestador.
 * Padrão: bloqueado. O admin libera no cadastro e pode ajustar por venda.
 * As permissões ficam em tabelas só do admin; o banco aplica em
 * my_commission_statement() e my_sale_disclosure().
 */
export type BeneficiaryType = "partner" | "referrer" | "service_provider";

export type VisibilityKey = "see_gross" | "see_payments" | "see_deductions";

export const VISIBILITY_ITEMS: { key: VisibilityKey; label: string; hint: string }[] = [
  { key: "see_gross", label: "Valor bruto da venda", hint: "O valor total que o cliente paga." },
  { key: "see_payments", label: "Pagamentos do cliente", hint: "Parcelas, o que foi pago e o que está em aberto. Os valores das parcelas também revelam o total." },
  { key: "see_deductions", label: "Deduções", hint: "Imposto, jurídico, sistema, PJ e demais itens descontados do bruto." },
];

export const BENEFICIARY_LABEL: Record<BeneficiaryType, string> = {
  partner: "Parceiro",
  referrer: "Indicador",
  service_provider: "Prestador",
};

export type Visibility = Record<VisibilityKey, boolean>;
/** No ajuste por venda, null = segue o cadastro. */
export type VisibilityOverride = Record<VisibilityKey, boolean | null>;

export const NO_VISIBILITY: Visibility = { see_gross: false, see_payments: false, see_deductions: false };
export const INHERIT_ALL: VisibilityOverride = { see_gross: null, see_payments: null, see_deductions: null };

export function effectiveVisibility(base: Partial<Visibility> | null | undefined, override: Partial<VisibilityOverride> | null | undefined): Visibility {
  const out = { ...NO_VISIBILITY };
  for (const { key } of VISIBILITY_ITEMS) {
    const o = override?.[key];
    out[key] = o === true || o === false ? o : Boolean(base?.[key]);
  }
  return out;
}

export function isInheritAll(o: Partial<VisibilityOverride>): boolean {
  return VISIBILITY_ITEMS.every(({ key }) => o[key] == null);
}
