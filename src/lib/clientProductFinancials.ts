/**
 * Valores das demandas (client_products) ficam num "cofre" só de admin:
 * a tabela client_product_financials. As colunas de dinheiro em
 * client_products ficam sempre vazias, para que parceiro, indicador,
 * prestador e colaborador possam ver a demanda sem ver o valor.
 *
 * Gravar continua igual: um gatilho no banco desvia value, custom_value,
 * discount, partner_commission e employee_commission para o cofre.
 *
 * Para LER, as telas do admin acrescentam CP_FIN ao select e passam o
 * resultado por mergeCpFin / mergeCpFinAll, que devolvem os valores nos
 * mesmos campos de sempre (row.value etc.). Para quem não é admin o cofre
 * vem vazio e os campos ficam nulos.
 */
export const CP_FIN =
  "cp_fin:client_product_financials(value, custom_value, discount, partner_commission, employee_commission)";

const MONEY_FIELDS = ["value", "custom_value", "discount", "partner_commission", "employee_commission"] as const;

export type CpMoney = {
  value: number | null;
  custom_value: number | null;
  discount: number | null;
  partner_commission: number | null;
  employee_commission: number | null;
};

export type WithCpMoney<T> = Omit<T, "cp_fin"> & CpMoney;

export function mergeCpFin<T>(row: T): WithCpMoney<T> {
  if (!row || typeof row !== "object") return row as unknown as WithCpMoney<T>;
  const { cp_fin, ...rest } = row as Record<string, unknown>;
  const fin = (Array.isArray(cp_fin) ? cp_fin[0] : cp_fin) as Record<string, unknown> | null | undefined;
  const out: Record<string, unknown> = { ...rest };
  for (const k of MONEY_FIELDS) out[k] = (fin?.[k] as number | null | undefined) ?? null;
  return out as WithCpMoney<T>;
}

export function mergeCpFinAll<T>(rows: T[] | null | undefined): WithCpMoney<T>[] {
  return (rows ?? []).map(mergeCpFin);
}
