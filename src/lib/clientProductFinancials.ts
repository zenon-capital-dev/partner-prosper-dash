import { supabase } from "@/integrations/supabase/client";

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

const CP_MONEY_COLS = "value, custom_value, discount, partner_commission, employee_commission";
const TABLE_NOT_FOUND = "PGRST205";

let vaultProbe: Promise<boolean> | null = null;

/**
 * O código do cofre pode ser publicado antes de a migration 20261103210000 ser
 * aplicada. Sem a tabela, pedir CP_FIN derruba a consulta inteira e a demanda
 * some da tela. Enquanto o cofre não existir, os valores continuam nas colunas
 * de client_products. Aplicada a migration, volta a ler o cofre ao recarregar.
 */
export async function cpFinSelect(): Promise<string> {
  if (!vaultProbe) {
    vaultProbe = (async () => {
      const { error } = await (supabase as any).from("client_product_financials").select("client_product_id").limit(1);
      return error?.code !== TABLE_NOT_FOUND;
    })();
  }
  return (await vaultProbe) ? CP_FIN : CP_MONEY_COLS;
}

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
  if (!("cp_fin" in row)) return row as unknown as WithCpMoney<T>;
  const { cp_fin, ...rest } = row as Record<string, unknown>;
  const fin = (Array.isArray(cp_fin) ? cp_fin[0] : cp_fin) as Record<string, unknown> | null | undefined;
  const out: Record<string, unknown> = { ...rest };
  for (const k of MONEY_FIELDS) out[k] = (fin?.[k] as number | null | undefined) ?? null;
  return out as WithCpMoney<T>;
}

export function mergeCpFinAll<T>(rows: T[] | null | undefined): WithCpMoney<T>[] {
  return (rows ?? []).map(mergeCpFin);
}
