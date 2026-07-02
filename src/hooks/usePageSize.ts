import { useState } from "react";

/**
 * Tamanho de página por listagem.
 * Sempre inicia em 10 ao recarregar a página (não persistido) — evita travar
 * a UI caso o usuário tenha deixado "Todos" selecionado em uma sessão anterior.
 * Valor -1 representa "Todos".
 */
export function usePageSize(initial: number = 10) {
  const [pageSize, setPageSize] = useState<number>(initial);
  return { pageSize, setPageSize };
}

export const PAGE_SIZE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 10, label: "10" },
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: -1, label: "Todos" },
];
