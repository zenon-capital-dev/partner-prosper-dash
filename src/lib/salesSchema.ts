import { supabase } from "@/integrations/supabase/client";

/**
 * O código da cascata de deduções pode ser publicado antes de as migrations
 * 20261103220000 a 20261103260000 serem aplicadas no banco. Sem elas, pedir
 * estas colunas derruba a consulta inteira e a tela mostra zero vendas.
 *
 * Por isso as telas perguntam ao banco uma vez e só pedem as colunas se elas
 * existirem. Quando as migrations forem aplicadas, tudo volta a valer sozinho
 * ao recarregar a página, sem mudar o código.
 */
const UNDEFINED_COLUMN = "42703";
const SALES_DEDUCTION_COLS = "deduction_model, deduction_review_pending";

let probe: Promise<boolean> | null = null;

export function salesSchemaIsCurrent(): Promise<boolean> {
  if (!probe) {
    probe = (async () => {
      const { error } = await (supabase as any).from("sales").select(SALES_DEDUCTION_COLS).limit(1);
      return error?.code !== UNDEFINED_COLUMN;
    })();
  }
  return probe;
}

/** Trecho para somar ao select de sales: vazio se o banco ainda não tem as colunas. */
export async function salesDeductionSelect(): Promise<string> {
  return (await salesSchemaIsCurrent()) ? `, ${SALES_DEDUCTION_COLS}` : "";
}

/** Tira do payload da venda as colunas que o banco ainda não tem. */
export async function salesPayloadForSchema<T extends Record<string, unknown>>(payload: T): Promise<T> {
  if (await salesSchemaIsCurrent()) return payload;
  const { installments_count, first_due_date, deduction_model, ...rest } = payload;
  return rest as unknown as T;
}
