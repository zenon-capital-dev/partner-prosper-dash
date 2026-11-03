/**
 * Cascata de deduções da venda.
 *
 * A receita do cliente não entra limpa: antes da comissão do parceiro a Zenon
 * provisiona as deduções da operação (imposto, jurídico, sistema, prestador,
 * PJ, taxas...). O que sobra é a base de cálculo do parceiro.
 *
 * Todas as deduções incidem sobre o BRUTO. Exemplo:
 *   bruto 1.000.000; imposto 15%, jurídico 2%, sistema 3%, prestador 5%, PJ 1 15%
 *   => deduções 400.000, base 600.000; parceiro 10% => 60.000.
 *
 * As mesmas regras rodam no banco (private.sale_deduction_totals e
 * handle_sale_splits). Este arquivo existe para a tela mostrar exatamente o que
 * o banco vai gravar.
 */

export type DeductionCategory =
  | "imposto"
  | "juridico"
  | "sistema"
  | "prestador"
  | "pj"
  | "taxa"
  | "custo_zenon"
  | "outros";

export const DEDUCTION_CATEGORIES: { value: DeductionCategory; label: string }[] = [
  { value: "imposto", label: "Imposto" },
  { value: "juridico", label: "Jurídico" },
  { value: "sistema", label: "Sistema" },
  { value: "prestador", label: "Prestador de serviço" },
  { value: "pj", label: "PJ" },
  { value: "taxa", label: "Taxa" },
  { value: "custo_zenon", label: "Custo Zenon" },
  { value: "outros", label: "Outros" },
];

export interface DeductionType {
  id: string;
  name: string;
  category: DeductionCategory;
  default_percent: number | null;
  default_fixed_amount: number | null;
  sort_order: number;
  active: boolean;
}

export interface DeductionRow {
  deduction_type_id: string;
  /** "percent" usa percent sobre o bruto; "fixed" usa fixed_amount em R$. */
  mode: "percent" | "fixed";
  percent: number | null;
  fixed_amount: number | null;
}

export type DeductionModel = "cascata" | "legado";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function deductionAmount(row: DeductionRow, gross: number): number {
  if (row.mode === "fixed") return round2(Math.max(0, Number(row.fixed_amount) || 0));
  return round2((Math.max(0, Number(gross) || 0) * (Number(row.percent) || 0)) / 100);
}

export interface DeductionTotals {
  /** Tudo que não é prestador: imposto, jurídico, sistema, PJ, taxas, custo Zenon. */
  zenonCost: number;
  /** Soma das deduções da categoria prestador. */
  providerCost: number;
  total: number;
}

export function deductionTotals(rows: DeductionRow[], types: DeductionType[], gross: number): DeductionTotals {
  const catById = new Map(types.map((t) => [t.id, t.category]));
  let zenonCost = 0;
  let providerCost = 0;
  for (const r of rows) {
    const amt = deductionAmount(r, gross);
    if (catById.get(r.deduction_type_id) === "prestador") providerCost += amt;
    else zenonCost += amt;
  }
  zenonCost = round2(zenonCost);
  providerCost = round2(providerCost);
  return { zenonCost, providerCost, total: round2(zenonCost + providerCost) };
}

/** Base de cálculo do parceiro, igual ao banco (handle_sale_splits). */
export function partnerBase(gross: number, zenonCost: number, providerCost: number, model: DeductionModel): number {
  const g = Number(gross) || 0;
  const b = g - (Number(zenonCost) || 0) - (model === "cascata" ? Number(providerCost) || 0 : 0);
  return round2(Math.max(0, b));
}

/** Converte linhas vindas do banco (percent/fixed_amount) para o formato da tela. */
export function rowFromDb(r: { deduction_type_id: string; percent: number | null; fixed_amount: number | null }): DeductionRow {
  return {
    deduction_type_id: r.deduction_type_id,
    mode: r.fixed_amount != null ? "fixed" : "percent",
    percent: r.percent != null ? Number(r.percent) : null,
    fixed_amount: r.fixed_amount != null ? Number(r.fixed_amount) : null,
  };
}

/** Converte linha da tela para gravar no banco: só um dos dois campos preenchido. */
export function rowToDb(r: DeductionRow) {
  return r.mode === "fixed"
    ? { deduction_type_id: r.deduction_type_id, percent: null, fixed_amount: Number(r.fixed_amount) || 0 }
    : { deduction_type_id: r.deduction_type_id, percent: Number(r.percent) || 0, fixed_amount: null };
}

export function sameRows(a: DeductionRow[], b: DeductionRow[]): boolean {
  const key = (rows: DeductionRow[]) =>
    JSON.stringify(rows.map(rowToDb).sort((x, y) => x.deduction_type_id.localeCompare(y.deduction_type_id)));
  return key(a) === key(b);
}
