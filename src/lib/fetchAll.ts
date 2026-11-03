/**
 * Busca todas as linhas de uma consulta do Supabase em páginas de 1000
 * (o limite por resposta da API). Evita somas e listas truncadas quando a
 * tabela cresce. `build(from, to)` deve devolver a consulta já com `.range(from, to)`.
 */
export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  { pageSize = 1000, max = 50_000 }: { pageSize?: number; max?: number } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
