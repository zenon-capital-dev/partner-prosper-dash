import { supabase } from "@/integrations/supabase/client";

export interface FkCheck {
  /** Tabela filha que pode referenciar o registro */
  table: string;
  /** Coluna FK na tabela filha */
  column: string;
  /** Rótulo amigável para mostrar ao usuário */
  label?: string;
}

export interface SafeDeleteResult {
  canDelete: boolean;
  /** Vínculos encontrados: { tabela: count } */
  blockedBy: Record<string, number>;
  totalBlocked: number;
}

/**
 * Verifica se um registro pode ser deletado checando FKs em outras tabelas.
 * Retorna a contagem de vínculos por tabela. Não deleta nada.
 */
export async function checkFkLinks(
  id: string,
  fkChecks: FkCheck[]
): Promise<SafeDeleteResult> {
  const blockedBy: Record<string, number> = {};
  await Promise.all(
    fkChecks.map(async (c) => {
      const { count } = await supabase
        .from(c.table as any)
        .select("id", { count: "exact", head: true })
        .eq(c.column, id);
      if (count && count > 0) blockedBy[c.label ?? c.table] = count;
    })
  );
  const totalBlocked = Object.values(blockedBy).reduce((a, b) => a + b, 0);
  return { canDelete: totalBlocked === 0, blockedBy, totalBlocked };
}

export function summarizeBlocks(blockedBy: Record<string, number>): string {
  return Object.entries(blockedBy)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
}
